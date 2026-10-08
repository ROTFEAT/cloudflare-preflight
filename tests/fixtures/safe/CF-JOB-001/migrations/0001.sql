CREATE TABLE jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER);
CREATE INDEX jobs_done_id ON jobs(done,id);
