-- Optional MySQL history. The service creates these tables itself on startup when DB_URL
-- is set; this file is the same schema for reviewing or creating it by hand.

CREATE TABLE IF NOT EXISTS country (
  code        CHAR(2)      PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  lang        VARCHAR(10)  NULL,
  has_edition BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS article (
  id            CHAR(12)      NOT NULL,   -- first 12 hex characters of a hash of the canonical URL
  country_code  CHAR(2)       NOT NULL,
  section       ENUM('nature','society','technology') NOT NULL,
  title         VARCHAR(500)  NOT NULL,
  source        VARCHAR(200)  NOT NULL,
  url           VARCHAR(2048) NOT NULL,
  summary       VARCHAR(300)  NULL,
  published_at  DATETIME      NOT NULL,   -- UTC
  first_seen_at DATETIME      NOT NULL,   -- UTC
  last_seen_at  DATETIME      NOT NULL,   -- UTC
  PRIMARY KEY (country_code, section, id),
  INDEX idx_article_view (country_code, section, published_at DESC),
  CONSTRAINT fk_article_country FOREIGN KEY (country_code) REFERENCES country (code)
);

CREATE TABLE IF NOT EXISTS fetch_log (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  country_code  CHAR(2)  NOT NULL,
  section       ENUM('nature','society','technology') NOT NULL,
  started_at    DATETIME NOT NULL,        -- UTC
  duration_ms   INT      NOT NULL,
  status        ENUM('ok','empty','error') NOT NULL,
  item_count    INT      NOT NULL DEFAULT 0,
  error_message VARCHAR(500) NULL,
  INDEX idx_fetch_log_view (country_code, section, started_at)
);
