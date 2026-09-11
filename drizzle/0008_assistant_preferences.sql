CREATE TYPE assistant_tone AS ENUM ('warm', 'balanced', 'direct');
CREATE TYPE assistant_verbosity AS ENUM ('brief', 'balanced', 'detailed');

ALTER TABLE users
  ADD COLUMN assistant_preferred_name TEXT,
  ADD COLUMN assistant_tone assistant_tone NOT NULL DEFAULT 'balanced',
  ADD COLUMN assistant_verbosity assistant_verbosity NOT NULL DEFAULT 'balanced',
  ADD COLUMN assistant_greetings BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE assistant_sessions
  ADD COLUMN last_greeted_on DATE;
