# HiCrew Backend - Virtual Airline API

HiCrew Backend is a comprehensive RESTful API for managing virtual airline operations. Built with Node.js, Express, Prisma ORM, and MySQL/MariaDB, it provides complete functionality for pilot management, fleet operations, flight tracking, and administration systems.

## 🌟 Features

- **🔐 Authentication & Authorization** - JWT-based auth with role-based permissions
- **👨‍✈️ Pilot Management** - Complete pilot profiles with IVAO/VATSIM integration
- **✈️ Fleet Management** - Aircraft, routes, and fleet administration
- **📊 Flight Operations** - Flight planning, tracking, and reporting
- **🏆 Gamification** - Medals, ranks, and achievement system
- **🌐 Multi-airline Support** - Configurable for different virtual airlines
- **📧 Email Integration** - Automated notifications and communications
- **🔄 ACARS Integration** - Compatible with HiACARS flight tracking
- **📋 Administration Panel** - Complete backend for admin operations
- **🐳 Docker Support** - Easy deployment with Docker containers

## 🚀 Quick Setup

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MySQL** or **MariaDB** (v10.5+)
- **Git**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/alejandro-diazro/HiCrewBackend.git
   cd HiCrewBackend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit the .env file with your configuration
   nano .env  # or use your preferred editor
   ```

4. **Set up the database:**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run database migrations
   npx prisma migrate dev
   ```

5. **Seed the database (optional but recommended):**
   ```bash
   # Add initial data and configuration
   node seed.js
   
   # Add airports data (optional - adds worldwide airports)
   node airports.js
   ```

6. **Start the server:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

The API will be available at `http://localhost:8000` (or your configured port).

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Server Configuration
PORT=8000

# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/hicrew"

# JWT Security
JWT_SECRET=your_very_secure_jwt_secret_here

# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_NAME=HiCrew

# Frontend URL (for CORS and email links)
FRONTEND_URL=http://localhost:3000

# Airline Configuration
ICAO_AIRLINE="HCW"  # Your airline's ICAO code
```

### Database Setup Options

#### Option 1: Local MySQL/MariaDB
```bash
# Install MySQL or MariaDB locally
# Create database
mysql -u root -p
CREATE DATABASE hicrew;
```

#### Option 2: Docker (Recommended for development)
```bash
# Use the provided docker-compose file
docker-compose up -d
```

## 🔧 Available Scripts

```bash
npm start              # Start production server
npm run dev           # Start development server with nodemon
npm run prisma:migrate # Run database migrations
npm run prisma:generate # Generate Prisma client
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new pilot
- `POST /api/auth/login` - Pilot login
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Reset password

### Pilot Management
- `GET /api/pilots` - List all pilots
- `GET /api/pilots/:id` - Get pilot details
- `PUT /api/pilots/:id` - Update pilot profile
- `DELETE /api/pilots/:id` - Delete pilot

### Fleet & Aircraft
- `GET /api/aircraft` - List aircraft types
- `GET /api/fleet` - List airline fleet
- `POST /api/fleet` - Add aircraft to fleet
- `PUT /api/fleet/:id` - Update fleet aircraft
- `DELETE /api/fleet/:id` - Remove from fleet

### Flight Operations
- `GET /api/flights` - List flights
- `POST /api/flights` - Create new flight
- `GET /api/routes` - List available routes
- `POST /api/routes` - Create new route

### Administration
- `GET /api/permissions` - List permissions
- `POST /api/permissions` - Assign permissions
- `GET /api/config` - Get airline configuration
- `PUT /api/config` - Update configuration

### Data Management
- `GET /api/airports` - List airports
- `GET /api/medals` - List medals/achievements
- `GET /api/ranks` - List pilot ranks
- `GET /api/simulators` - List supported simulators

*For complete API documentation, see the `/docs` endpoint when the server is running.*

## 🏗️ Project Structure

```
HiCrewBackend/
├── config/              # Database and app configuration
├── controllers/         # Business logic controllers
├── middleware/          # Authentication and validation middleware
│   ├── auth.js         # JWT authentication
│   └── permissions.js  # Role-based permissions
├── models/             # Data models (if using additional ORMs)
├── prisma/             # Prisma ORM configuration
│   ├── schema.prisma   # Database schema
│   └── migrations/     # Database migration files
├── routes/             # API route definitions
│   ├── auth.js         # Authentication routes
│   ├── pilots.js       # Pilot management
│   ├── fleet.js        # Fleet operations
│   ├── flights.js      # Flight operations
│   └── ...            # Other route files
├── utils/              # Utility functions
│   └── email.js        # Email sending utilities
├── .env.example        # Environment configuration template
├── docker-compose.yml  # Docker setup for database
├── seed.js            # Database seeding script
├── airports.js        # Airport data import script
├── cronJobs.js        # Scheduled tasks
└── server.js          # Main application entry point
```

## 🐳 Docker Setup

For easy development setup with Docker:

```bash
# Start the database container
docker-compose up -d

# The database will be available at localhost:3306
# Default credentials are in docker-compose.yml
```

## 🔄 Integration with Frontend

This backend is designed to work with the [HiCrew Frontend](https://github.com/alejandro-diazro/HiCrew):

1. **Start the backend** (this repository)
2. **Configure the frontend** to point to this API
3. **Update CORS settings** in the backend for your frontend URL

## 🧪 Testing

You can test the API using:

- **Postman** - Import the API collection (if available)
- **curl** - Command line testing
- **Frontend** - Direct integration testing

Example test request:
```bash
# Test server health
curl http://localhost:8000/api/health

# Login example
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pilot@example.com","password":"password"}'
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code conventions
- Add tests for new features
- Update documentation as needed
- Ensure all migrations are reversible
- Test with both MySQL and MariaDB if possible

## 🔒 Security

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt for secure password storage
- **Input Validation** - Comprehensive request validation
- **CORS Configuration** - Proper cross-origin resource sharing
- **Environment Variables** - Sensitive data stored securely

## 📊 Database Schema

The database uses Prisma ORM with the following main entities:

- **Pilots** - User accounts and profiles
- **Airlines** - Virtual airline configurations
- **Aircraft** - Aircraft types and specifications
- **Fleet** - Airline fleet management
- **Routes** - Flight routes and schedules
- **Flights** - Individual flight records
- **Permissions** - Role-based access control
- **Medals & Ranks** - Gamification system

## 🚨 Troubleshooting

### Common Issues

**Database connection fails:**
```bash
# Check your DATABASE_URL in .env
# Ensure MySQL/MariaDB is running
# Verify database exists and credentials are correct
```

**Prisma errors:**
```bash
# Regenerate Prisma client
npx prisma generate

# Reset database (CAUTION: This will delete all data)
npx prisma migrate reset
```

**Port already in use:**
```bash
# Change PORT in .env file
# Or kill the process using the port
lsof -ti:8000 | xargs kill
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🌟 Credits

Developed by [Alejandro Díaz](https://github.com/alejandro-diazro)

## 🔗 Related Projects

- **[HiCrew Frontend](https://github.com/alejandro-diazro/HiCrew)** - React frontend application
- **[HiACARS](https://diazro.me/hicrew)** - Flight tracking software

---

**Ready to manage your virtual airline?** ✈️

1. Setup the database
2. Configure your `.env`
3. Run migrations and seed data
4. Connect your frontend
5. Take off! 🚀
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