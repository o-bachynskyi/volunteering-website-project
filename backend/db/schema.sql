CREATE TABLE "role" (
  "role_id" char(10) PRIMARY KEY,
  "name" varchar(50) UNIQUE NOT NULL
);

CREATE TABLE "user" (
  "user_id" uuid PRIMARY KEY,
  "full_name" varchar(255) NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "password" varchar(255) NOT NULL,
  "role_id" char(10) NOT NULL,
  "image_url" varchar(255) DEFAULT null
);

CREATE TABLE "tag" (
  "tag_id" uuid PRIMARY KEY,
  "name" varchar(100) UNIQUE NOT NULL
);

CREATE TABLE "user_tag" (
  "user_id" uuid,
  "tag_id" uuid,
  PRIMARY KEY ("user_id", "tag_id")
);

CREATE TABLE "post_tag" (
  "post_id" uuid,
  "tag_id" uuid,
  PRIMARY KEY ("post_id", "tag_id")
);

CREATE TABLE "post" (
  "post_id" uuid PRIMARY KEY,
  "post_type_id" char(10) NOT NULL,
  "user_id" uuid NOT NULL,
  "title" varchar(100) NOT NULL,
  "description" varchar(255) NOT NULL,
  "image_url" varchar(255) DEFAULT null
);

CREATE TABLE "post_type" (
  "type_id" char(10) PRIMARY KEY,
  "name" varchar(50) UNIQUE NOT NULL
);

CREATE TABLE "assignment" (
  "assignment_id" uuid PRIMARY KEY,
  "volunteer_id" uuid NOT NULL,
  "post_id" uuid UNIQUE NOT NULL,
  "title" varchar(100) NOT NULL,
  "description" varchar(255) NOT NULL,
  "image_url" varchar(255) DEFAULT null
);

ALTER TABLE "user" ADD FOREIGN KEY ("role_id") REFERENCES "role" ("role_id");

ALTER TABLE "user_tag" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("user_id");

ALTER TABLE "user_tag" ADD FOREIGN KEY ("tag_id") REFERENCES "tag" ("tag_id");

ALTER TABLE "post_tag" ADD FOREIGN KEY ("post_id") REFERENCES "post" ("post_id");

ALTER TABLE "post_tag" ADD FOREIGN KEY ("tag_id") REFERENCES "tag" ("tag_id");

ALTER TABLE "post" ADD FOREIGN KEY ("post_type_id") REFERENCES "post_type" ("type_id");

ALTER TABLE "post" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("user_id");

ALTER TABLE "assignment" ADD FOREIGN KEY ("volunteer_id") REFERENCES "user" ("user_id");

ALTER TABLE "assignment" ADD FOREIGN KEY ("post_id") REFERENCES "post" ("post_id");
