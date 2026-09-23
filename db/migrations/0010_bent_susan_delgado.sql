CREATE TABLE "public_mutation_rate_limits" (
	"scope" text NOT NULL,
	"identity_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer NOT NULL,
	"request_limit" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_mutation_rate_limits_pkey" PRIMARY KEY("scope","identity_hash","window_started_at"),
	CONSTRAINT "public_mutation_rate_limits_scope_check" CHECK ("public_mutation_rate_limits"."scope" in ('subscribe_client', 'subscribe_email', 'submit_client')),
	CONSTRAINT "public_mutation_rate_limits_identity_hash_check" CHECK (char_length("public_mutation_rate_limits"."identity_hash") = 64 and "public_mutation_rate_limits"."identity_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "public_mutation_rate_limits_count_check" CHECK ("public_mutation_rate_limits"."request_count" >= 1 and "public_mutation_rate_limits"."request_limit" >= 1 and "public_mutation_rate_limits"."request_count" <= "public_mutation_rate_limits"."request_limit"),
	CONSTRAINT "public_mutation_rate_limits_window_check" CHECK ("public_mutation_rate_limits"."expires_at" > "public_mutation_rate_limits"."window_started_at")
);
--> statement-breakpoint
CREATE INDEX "public_mutation_rate_limits_expires_idx" ON "public_mutation_rate_limits" USING btree ("expires_at");
--> statement-breakpoint
CREATE FUNCTION "consume_public_mutation_rate_limits"(
	"p_dimensions" jsonb,
	"p_now" timestamp with time zone
)
-- Do not name the PL/pgSQL output variable `scope`: that collides with the table
-- column in ON CONFLICT/RETURNING and makes every real invocation fail with an
-- ambiguous-column error even though the function can be created successfully.
RETURNS TABLE("consumed_scope" text)
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
AS $function$
DECLARE
	dimension_count integer;
	lock_key bigint;
BEGIN
	IF p_now IS NULL OR jsonb_typeof(p_dimensions) IS DISTINCT FROM 'array' THEN
		RAISE EXCEPTION 'invalid public mutation rate-limit input' USING ERRCODE = '22023';
	END IF;
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'public mutation rate limiting requires read committed isolation' USING ERRCODE = '25000';
	END IF;

	dimension_count := jsonb_array_length(p_dimensions);
	IF dimension_count < 1 OR dimension_count > 2 THEN
		RAISE EXCEPTION 'invalid public mutation rate-limit dimension count' USING ERRCODE = '22023';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM jsonb_to_recordset(p_dimensions) AS dimension(
			"scope" text,
			"identity_hash" text,
			"window_started_at" timestamp with time zone,
			"request_limit" integer,
			"expires_at" timestamp with time zone
		)
		WHERE dimension.scope IS NULL
			OR dimension.scope NOT IN ('subscribe_client', 'subscribe_email', 'submit_client')
			OR dimension.identity_hash IS NULL
			OR dimension.identity_hash !~ '^[0-9a-f]{64}$'
			OR dimension.request_limit IS NULL
			OR dimension.request_limit < 1
			OR dimension.request_limit > 1000
			OR dimension.window_started_at IS NULL
			OR dimension.expires_at IS NULL
			OR dimension.window_started_at > p_now
			OR dimension.expires_at <= p_now
			OR dimension.expires_at > dimension.window_started_at + interval '24 hours'
	) OR (
		SELECT count(DISTINCT dimension.scope)
		FROM jsonb_to_recordset(p_dimensions) AS dimension("scope" text)
	) <> dimension_count THEN
		RAISE EXCEPTION 'invalid public mutation rate-limit dimension' USING ERRCODE = '22023';
	END IF;

	-- Every caller obtains the same global lock order. This avoids deadlocks when
	-- two subscribe requests overlap on only their client or email dimension.
	FOR lock_key IN
		SELECT ordered_keys.lock_key
		FROM (
			SELECT DISTINCT hashtextextended(
				dimension.scope || ':' || dimension.identity_hash || ':' ||
				extract(epoch FROM dimension.window_started_at)::text,
				0
			) AS lock_key
			FROM jsonb_to_recordset(p_dimensions) AS dimension(
				"scope" text,
				"identity_hash" text,
				"window_started_at" timestamp with time zone
			)
		) AS ordered_keys
		ORDER BY ordered_keys.lock_key
	LOOP
		PERFORM pg_advisory_xact_lock(lock_key);
	END LOOP;

	-- This is a new SPI command after every advisory lock has been acquired. At
	-- PostgreSQL's READ COMMITTED default it receives a fresh snapshot, including
	-- a concurrent caller's commit that this function may have waited behind.
	IF EXISTS (
		SELECT 1
		FROM jsonb_to_recordset(p_dimensions) AS dimension(
			"scope" text,
			"identity_hash" text,
			"window_started_at" timestamp with time zone,
			"request_limit" integer
		)
		JOIN "public_mutation_rate_limits" AS counter
			ON counter.scope = dimension.scope
			AND counter.identity_hash = dimension.identity_hash
			AND counter.window_started_at = dimension.window_started_at
		WHERE counter.request_count >= dimension.request_limit
	) THEN
		RETURN;
	END IF;

	-- The advisory locks cover every key below. The multi-row statement either
	-- increments all requested dimensions or rolls back all of them on error.
	RETURN QUERY
	INSERT INTO "public_mutation_rate_limits" AS counter (
		"scope",
		"identity_hash",
		"window_started_at",
		"request_count",
		"request_limit",
		"expires_at",
		"updated_at"
	)
	SELECT
		dimension.scope,
		dimension.identity_hash,
		dimension.window_started_at,
		1,
		dimension.request_limit,
		dimension.expires_at,
		p_now
	FROM jsonb_to_recordset(p_dimensions) AS dimension(
		"scope" text,
		"identity_hash" text,
		"window_started_at" timestamp with time zone,
		"request_limit" integer,
		"expires_at" timestamp with time zone
	)
	ON CONFLICT ("scope", "identity_hash", "window_started_at") DO UPDATE
	SET
		"request_count" = counter.request_count + 1,
		"request_limit" = excluded.request_limit,
		"expires_at" = excluded.expires_at,
		"updated_at" = excluded.updated_at
	RETURNING counter.scope AS consumed_scope;

	DELETE FROM "public_mutation_rate_limits"
	WHERE ctid IN (
		SELECT ctid
		FROM "public_mutation_rate_limits"
		WHERE expires_at < p_now
		ORDER BY expires_at
		LIMIT 100
	);
END;
$function$;
--> statement-breakpoint
COMMENT ON FUNCTION "consume_public_mutation_rate_limits"(jsonb, timestamp with time zone) IS
'Atomically consumes every HMAC-only public mutation dimension or none, locking keys in deterministic order.';
