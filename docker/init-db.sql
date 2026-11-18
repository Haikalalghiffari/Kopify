-- Inisialisasi database pengujian (test database) di PostgreSQL Docker
SELECT 'CREATE DATABASE koperasi_test_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'koperasi_test_db')\gexec

GRANT ALL PRIVILEGES ON DATABASE koperasi_test_db TO koperasi_user;
