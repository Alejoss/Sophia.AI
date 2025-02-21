# Sophia.AI
A descentralized, blockchain-backed library that uses AI to interact with and to certify documents.


**Installation**

run the docker containers and build the image from the root directory of acbc_app:

docker-compose up --build

**DATABASE CONFIGURATION**

Create the database in the docker container. Make sure the postgres container is running.

docker exec -it sophiaaiacademiablockchain-postgres-1 bash      
docker exec -it <container_name_or_id> bash

psql -U postgres

CREATE DATABASE academia_blockchain_db;

GRANT ALL PRIVILEGES ON DATABASE academia_blockchain_db TO postgres;


*Important, don't forget to run migrations:*

docker-compose exec backend python manage.py makemigrations
docker-compose exec backend python manage.py migrate

*Optionally create a superuser:*

docker-compose exec backend python manage.py create_admin

*Load fixtures*

docker-compose exec backend python manage.py load_fixtures

*Load the libraries database with initial test data*

docker-compose exec backend python manage.py load_libraries

*To run the django tests in the docker container run*

docker-compose exec backend python manage.py test
