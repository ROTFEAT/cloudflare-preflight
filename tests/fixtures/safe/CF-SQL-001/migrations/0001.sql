CREATE TABLE jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER);
CREATE INDEX jobs_status_id ON jobs(status,id);
