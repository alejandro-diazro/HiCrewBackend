# HiCrew Backend

HiCrew Backend is a RESTful API for managing pilots, permissions, and flights in a virtual aviation platform. Built with Node.js, Express, Prisma, and MariaDB, it provides user authentication with JWT, a role-based permission system, and flight management capabilities.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
    - [Local Setup](#local-setup)
    - [Docker Setup](#docker-setup)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
- [Testing with Postman](#testing-with-postman)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features
- User registration and login with JWT authentication.
- Role-based permission system for pilots (e.g., `VIEW_PILOTS`, `MANAGE_FLIGHTS`, `ADMIN`).
- Management of pilot profiles, permissions, and flight records.
- Integration with MariaDB for persistent storage.
- Support for IVAO and VATSIM IDs.
- Docker support for easy database setup.

## Prerequisites
- **Node.js** (v16 or higher)
- **npm** (v8 or higher)
- **MariaDB** (v10.5 or higher) or Docker for database hosting
- **Git** (for cloning the repository)
- **Postman** (optional, for testing API endpoints)

## Installation

### Local Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/hicrew-backend.git
   cd hicrew-backend
2. **Install dependencies**:
    ```bash
   npm install
3.  **Set up MariaDB**:
    * Install MariaDB locally if not using Docker.
    * Create a database named `hicrew`:
        ```sql
        CREATE DATABASE hicrew;
        ```
4.  **Configure environment variables**:
    * Create a `.env` file in the root directory based on the example below:
        ```env
        DATABASE_URL="mysql://hicrew_user:hicrew_password@localhost:3306/hicrew"
        JWT_SECRET="your_jwt_secret_here"
        ```
    * Replace `hicrew_user`, `hicrew_password`, and `your_jwt_secret_here` with your own secure credentials.
5.  **Apply database migrations**:
    * Initialize the database schema with Prisma:
        ```bash
        npx prisma migrate dev --name init
        ```
6.  **Seed permissions (optional)**:
    * Run the seed script to populate the `Permission` table with default permissions:
        ```bash
        node seed.js
        ```

### Docker Setup

1.  Clone the repository (as above).
2.  Install dependencies (as above).
3.  **Set up Docker**:
    * Ensure Docker and Docker Compose are installed.
    * Create or use the provided `docker-compose.yml` file to set up MariaDB:
        ```yaml
        version: '3.8'
        services:
          mariadb:
            image: mariadb:10.5
            environment:
              MYSQL_ROOT_PASSWORD: root_password
              MYSQL_DATABASE: hicrew
              MYSQL_USER: hicrew_user
              MYSQL_PASSWORD: hicrew_password
            ports:
              - "3306:3306"
            volumes:
              - mariadb_data:/var/lib/mysql
        volumes:
          mariadb_data:
        ```
4.  **Start the MariaDB container**:
    ```bash
    docker-compose up -d
    ```
5.  **Configure environment variables**:
    * Update `.env` to point to the Docker-hosted MariaDB:
        ```env
        DATABASE_URL="mysql://hicrew_user:hicrew_password@mariadb:3306/hicrew"
        JWT_SECRET="your_jwt_secret_here"
        ```
6.  Apply migrations and seed:
    * Run the migrations and seed script as described in the Local Setup.

## Configuration

* **Database**: Ensure MariaDB is running and accessible via the `DATABASE_URL`.
* **JWT**: Set a secure `JWT_SECRET` for signing authentication tokens.
* **Permissions**: The `seed.js` script populates permissions like `VIEW_PILOTS`, `MANAGE_FLIGHTS`, `MANAGE_PILOTS`, and `ADMIN`. Modify `seed.js` to add custom permissions if needed.

## Running the Project

1.  **Start the server**:
    ```bash
    npm start
    ```
    The API will be available at `http://localhost:8000`.
2.  **Verify the server**:
    * Open `http://localhost:8000/pilots` in a browser or Postman to see the public list of pilots (no authentication required).

## API Endpoints

| Method | Endpoint                 | Description                                      | Authentication |
| :----- | :----------------------- | :----------------------------------------------- | :------------- |
| POST   | `/auth/register`        | Register a new pilot                             | None           |
| POST   | `/auth/login`           | Log in and obtain a JWT token                    | None           |
| GET    | `/pilots`               | List pilots (limited fields)                     | None           |
| GET    | `/pilots/authenticated` | List pilots (more fields)                        | JWT token      |
| GET    | `/pilots/admin`         | List all pilots with full details                | JWT token, ADMIN |

## Testing with Postman
1.  **Register a pilot**:
    * Method: `POST`
    * URL: `http://localhost:8000/auth/register`
    * Body (JSON):
        ```json
        {
          "email": "test@example.com",
          "password": "password123",
          "firstName": "John",
          "lastName": "Doe",
          "birthDate": "1990-01-01",
          "callsign": "TST123",
          "ivaoId": "123456",
          "vatsimId": "654321"
        }
        ```
    * Response: Returns pilot details and a JWT token (no permissions assigned by default).

2.  **Log in**:
    * Method: `POST`
    * URL: `http://localhost:8000/auth/login`
    * Body (JSON):
        ```json
        {
          "email": "test@example.com",
          "password": "password123"
        }
        ```
    * Response: Returns pilot details and a JWT token.

3.  **Access admin route**:
    * Method: `GET`
    * URL: `http://localhost:8000/pilots/admin`
    * Headers: `Authorization: Bearer <jwt_token>`
    * Note: Requires a pilot with `ADMIN` permission. Assign it manually if needed:
        ```sql
        INSERT INTO pilot_permissions (pilot_id, permission_id) VALUES (1, (SELECT id FROM Permission WHERE name = 'ADMIN'));
        ```
## Project Structure
hicrew-backend/

├── middleware/          # Authentication and permission middlewares

│   ├── auth.js         # JWT authentication middleware

│   ├── permissions.js  # Permission checking middleware

├── prisma/              # Prisma schema and migrations

│   ├── schema.prisma   # Database schema

│   ├── migrations/     # Migration files

├── routes/              # API route handlers

│   ├── auth.js         # Authentication routes (register, login)

│   ├── pilots.js       # Pilot management routes

├── .env                 # Environment variables (not tracked)

├── .gitignore           # Git ignore file

├── docker-compose.yml   # Docker configuration for MariaDB

├── package.json         # Node.js dependencies and scripts

├── seed.js              # Script to seed permissions

├── index.js             # Entry point

└── README.md            # Project documentation

## Contributing

Contributions are welcome! To contribute:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/your-feature`).
3.  Commit your changes (`git commit -m 'Add your feature'`).
4.  Push to the branch (`git push origin feature/your-feature`).
5.  Open a Pull Request.

Please ensure your code follows the project's coding style and includes tests where applicable. Report issues or suggest features via the [Issues page](https://github.com/<your-username>/hicrew-backend/issues).

## License

This project is licensed under the MIT License ([LICENSE](LICENSE)). You are free to use, modify, and distribute this software, as long as you include the license and copyright notice.