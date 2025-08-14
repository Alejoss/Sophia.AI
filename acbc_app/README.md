# Sophia.AI
A descentralized, blockchain-backed library that uses AI to interact with and to certify documents.

**Test Server**
https://sophia-ai.algobeat.com/
https://sophia-ai-api.algobeat.com/
ssh root@46.62.163.3

**Installation**

run the docker containers and build the image from the root directory of acbc_app:

docker-compose up --build
docker-compose up --build backend
docker-compose up --build frontend

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
docker-compose exec backend python manage.py setup_google_oauth

*Optionally create a superuser:*

docker-compose exec backend python manage.py create_admin

*Populate the Database*

*Load the libraries database with initial test data*

docker-compose exec backend python manage.py load_libraries

*Populate the database with test data in the correct order:*

# 1. Create admin user (optional)
docker-compose exec backend python manage.py create_admin

# 2. Setup Google OAuth (required for social login)
docker-compose exec backend python manage.py setup_google_oauth

# 3. Populate cryptocurrencies (required for user profiles)
docker-compose exec backend python manage.py populate_cryptocurrencies

# 4. Populate users and profiles (foundation for everything else)
docker-compose exec backend python manage.py populate_users

# 5. Populate content, topics, libraries, publications, and events
docker-compose exec backend python manage.py populate_content

# 6. Populate knowledge paths, nodes, and quizzes
docker-compose exec backend python manage.py populate_knowledge_paths

# 7. Populate user interactions (comments, votes, bookmarks)
docker-compose exec backend python manage.py populate_interactions

*Note: Run these commands in order as they have dependencies on each other. You can add --clear flag to any command to clear existing data before populating, or --skip-existing to skip objects that already exist.*

*To run the django tests in the docker container run*

docker-compose exec backend python manage.py test -v 2
docker-compose exec backend python manage.py test quizzes -v 2
docker-compose exec backend python manage.py test profiles.tests.test_token_refresh -v 2
