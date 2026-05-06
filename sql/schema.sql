CREATE TABLE IF NOT EXISTS role (
  role_id INTEGER PRIMARY KEY,
  role_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS post_type (
  post_type_id INTEGER PRIMARY KEY,
  post_type_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS tag (
  tag_id INTEGER PRIMARY KEY,
  tag_name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS app_user (
  user_rnokpp VARCHAR(32) PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES role(role_id),
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  user_description TEXT DEFAULT '',
  user_image_url TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS user_tag (
  user_rnokpp VARCHAR(32) NOT NULL REFERENCES app_user(user_rnokpp) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tag(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (user_rnokpp, tag_id)
);

CREATE TABLE IF NOT EXISTS post (
  post_id INTEGER PRIMARY KEY,
  user_rnokpp VARCHAR(32) NOT NULL REFERENCES app_user(user_rnokpp) ON DELETE CASCADE,
  post_type_id INTEGER NOT NULL REFERENCES post_type(post_type_id),
  post_title VARCHAR(255) NOT NULL,
  post_description TEXT NOT NULL,
  post_status VARCHAR(32) NOT NULL DEFAULT 'active',
  post_datetime TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_tag (
  tag_id INTEGER NOT NULL REFERENCES tag(tag_id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES post(post_id) ON DELETE CASCADE,
  PRIMARY KEY (tag_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_image (
  post_image_id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES post(post_id) ON DELETE CASCADE,
  post_image_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS response (
  response_id INTEGER PRIMARY KEY,
  user_rnokpp VARCHAR(32) NOT NULL REFERENCES app_user(user_rnokpp) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES post(post_id) ON DELETE CASCADE,
  response_title VARCHAR(255) NOT NULL,
  response_description TEXT NOT NULL,
  response_datetime TIMESTAMP NOT NULL DEFAULT NOW(),
  response_status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS response_image (
  response_image_id INTEGER PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES response(response_id) ON DELETE CASCADE,
  response_image_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report (
  report_number INTEGER PRIMARY KEY,
  user_rnokpp VARCHAR(32) NOT NULL REFERENCES app_user(user_rnokpp) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES post(post_id) ON DELETE CASCADE,
  report_type VARCHAR(32) NOT NULL,
  report_text TEXT NOT NULL,
  creation_datetime TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_image (
  report_image_id INTEGER PRIMARY KEY,
  report_number INTEGER NOT NULL REFERENCES report(report_number) ON DELETE CASCADE,
  report_image_url TEXT NOT NULL
);

INSERT INTO role (role_id, role_name)
VALUES
  (1, 'Волонтер'),
  (2, 'Військовий')
ON CONFLICT (role_id) DO UPDATE
SET role_name = EXCLUDED.role_name;

INSERT INTO post_type (post_type_id, post_type_name)
VALUES
  (1, 'Збір коштів'),
  (2, 'Запит на допомогу')
ON CONFLICT (post_type_id) DO UPDATE
SET post_type_name = EXCLUDED.post_type_name;
