# Finance Manager - Desktop Application

## 🎯 Overview

Finance Manager is a full-featured desktop application for managing financial lines, customers, transactions, collections, and accounts. Built with React frontend, Node.js/Express backend, and can be packaged as a native desktop application using Electron.

## ✨ Key Features

- **Authentication**: Secure JWT-based login system
- **Dashboard**: Overview of all financial lines with Balance Forward (BF) tracking
- **Line Management**: Create, edit, and delete financial lines
- **Customer Management**: Full CRUD operations for customers
- **Transaction Tracking**: Record payments, expenses, and adjustments
- **Collections**: View and manage collections by date/day
- **Account Management**: Track multiple accounts with fund transfers
- **Chat System**: Customer communication history
- **PDF Export**: Generate transaction reports
- **Theme Support**: Light and dark mode

### Technical Highlights
- **Offline-first**: All data stored locally in JSON files
- **REST API**: Express backend with comprehensive endpoints
- **Modern UI**: React with Tailwind CSS and shadcn/ui components
- **Cross-platform**: Works on Windows, macOS, Linux
- **JWT Security**: Token-based authentication
- **Data Persistence**: JSON file-based storage (no database required)

## 📦 Project Structure

```
app/
├── backend/                    # Express.js API server (port 8001)
│   ├── controllers/           # Business logic
│   ├── routes/                # API routes (39 endpoints)
│   ├── middleware/            # Authentication & validation
│   ├── models/                # Data models
│   ├── services/              # Business services
│   ├── data/                  # JSON file storage
│   ├── server.js              # Server entry point
│   ├── package.json           # Backend dependencies
│   └── .env                   # Backend configuration
├── frontend/                   # React application (port 3000)
│   ├── src/
│   │   ├── components/        # React UI components
│   │   ├── services/          # API service layer
│   │   ├── contexts/          # React contexts (Auth, Theme)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions
│   │   └── App.js             # Main application component
│   ├── public/                # Static assets
│   ├── package.json           # Frontend dependencies
│   └── .env                   # Frontend configuration
├── electron/                   # Electron desktop wrapper (optional)
│   ├── main.js                # Electron entry point
│   ├── preload.js             # Security layer
│   └── icons/                 # Application icons
├── package.json                # Root dependencies & build scripts
├── electron-builder.yml        # Desktop build configuration
├── README.md                   # This file
└── EXECUTABLE_BUILD_GUIDE.md   # Guide to create desktop executables
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Git** (optional, for cloning)

### Installation Steps

1. **Clone or download the repository**
```bash
git clone https://github.com/suresh6699/app.git
cd app
```

2. **Install backend dependencies**
```bash
cd backend
npm install
cd ..
```

3. **Install frontend dependencies**
```bash
cd frontend
yarn install
cd ..
```

4. **Install root dependencies (for Electron desktop build)**
```bash
npm install
```

### Running the Application

The application is configured to run via **supervisor** in production/preview mode:

```bash
# Start all services
sudo supervisorctl restart all

# Check service status
sudo supervisorctl status

# View backend logs
tail -f /var/log/supervisor/backend.out.log

# View frontend logs
tail -f /var/log/supervisor/frontend.out.log
```

**Services:**
- **Backend**: Runs on `http://localhost:8001`
- **Frontend**: Runs on `http://localhost:3000`

### Development Mode (Alternative)

Run components separately in different terminals:

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
yarn start
```

### Default Login Credentials

```
Username: admin
Password: admin123
```

*Change these in production by modifying the authentication logic*

## 📦 Building Desktop Application (Executable)

Want to create a standalone desktop application? See the **[EXECUTABLE_BUILD_GUIDE.md](./EXECUTABLE_BUILD_GUIDE.md)** for detailed instructions.

### Quick Build Commands

```bash
# Build for current platform
npm run package

# Build for specific platforms
npm run package:win      # Windows .exe
npm run package:mac      # macOS .dmg
npm run package:linux    # Linux .AppImage
```

### Build Output

Executables will be created in the `dist/` folder:
- **Windows**: `Finance Manager Setup 1.0.0.exe`
- **macOS**: `Finance Manager-1.0.0.dmg`
- **Linux**: `Finance Manager-1.0.0.AppImage`

📖 **For complete build instructions, installation guide, and troubleshooting**, see [EXECUTABLE_BUILD_GUIDE.md](./EXECUTABLE_BUILD_GUIDE.md)

## 🎨 Configuration

### Backend Configuration

Edit `backend/.env`:
```env
PORT=8001
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

### Frontend Configuration

Edit `frontend/.env`:
```env
REACT_APP_API_URL=
```
*(Leave empty to use proxy configuration in package.json)*

### Customizing Desktop Application

For app name, icon, and build customization, see [EXECUTABLE_BUILD_GUIDE.md](./EXECUTABLE_BUILD_GUIDE.md)

## 💾 Data Storage

The application uses **JSON file-based storage** (no database required):

- **Location**: `backend/data/`
- **Files**: Automatically created on first run
- **Structure**:
  ```
  backend/data/
  ├── lines.json              # Financial lines
  ├── customers/              # Customer data
  ├── transactions/           # Transaction records
  ├── collections/            # Collection data
  ├── accounts/               # Account information
  ├── days/                   # Daily summaries
  └── ...                     # Other data files
  ```

### Backup Your Data

To backup, simply copy the entire `backend/data/` folder to a safe location.

### Reset Data

To start fresh, delete the `backend/data/` folder and restart the backend server.

## 📱 API Endpoints

The backend provides a comprehensive REST API with the following key endpoints:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Lines Management
- `GET /api/lines` - Get all financial lines
- `POST /api/lines` - Create new line
- `PUT /api/lines/:id` - Update line
- `DELETE /api/lines/:id` - Delete line

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Collections
- `GET /api/collections` - Get collections by date
- `POST /api/collections` - Record collection

### Accounts
- `GET /api/accounts` - Get all accounts
- `POST /api/accounts` - Create account
- `PUT /api/accounts/:id` - Update account
- `POST /api/accounts/transfer` - Transfer between accounts

### Days
- `GET /api/days` - Get day summaries
- `POST /api/days` - Create day entry

### PDF Export
- `POST /api/pdf/generate` - Generate transaction PDF report

### Health Check
- `GET /api/health` - Check API status

**Full API documentation**: See `backend/API_EXAMPLES.md`  
**Postman Collection**: `backend/Finance_API.postman_collection.json`

## 🐛 Troubleshooting

### Backend Issues

**Backend won't start:**
- Check if port 8001 is available: `lsof -i :8001` (kill if needed)
- Verify Node.js is installed: `node --version`
- Check logs: `tail -f /var/log/supervisor/backend.err.log`
- Ensure `.env` file exists in `backend/` folder

**API returns errors:**
- Check backend logs for errors
- Verify JSON data files in `backend/data/` are not corrupted
- Restart backend: `sudo supervisorctl restart backend`

### Frontend Issues

**Frontend won't load:**
- Check if port 3000 is available
- Clear cache: `rm -rf frontend/node_modules/.cache`
- Restart frontend: `sudo supervisorctl restart frontend`
- Check logs: `tail -f /var/log/supervisor/frontend.err.log`

**Can't connect to backend:**
- Verify backend is running: `curl http://localhost:8001/api/health`
- Check proxy configuration in `frontend/package.json`
- Ensure `REACT_APP_API_URL` in `frontend/.env` is correct (or empty)

### Data Issues

**Data not saving:**
- Check `backend/data/` directory exists and is writable
- Verify file permissions: `ls -la backend/data/`
- Check backend logs for file write errors
- Ensure sufficient disk space

**Data corruption:**
- Restore from backup if available
- Check JSON file syntax with `cat backend/data/lines.json | jq`
- Delete corrupted files to regenerate defaults

### Build Issues

For desktop application build problems, see [EXECUTABLE_BUILD_GUIDE.md](./EXECUTABLE_BUILD_GUIDE.md#-troubleshooting-build-issues)

## 🔒 Security

**Important for Production:**
- Change `JWT_SECRET` in `backend/.env` to a strong random string
- Update default admin credentials
- Don't commit `.env` files to version control
- Keep Node.js and dependencies updated
- Use HTTPS in production deployments

## 📚 Additional Documentation

- **[EXECUTABLE_BUILD_GUIDE.md](./EXECUTABLE_BUILD_GUIDE.md)** - Complete guide to building desktop executables
- **backend/API_EXAMPLES.md** - Detailed API documentation with examples
- **backend/Finance_API.postman_collection.json** - Postman collection for API testing

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit changes: `git commit -m 'Add feature'`
5. Push to branch: `git push origin feature-name`
6. Submit a pull request

## 📞 Support

For help and support:
- Check the **Troubleshooting** section above
- Review [EXECUTABLE_BUILD_GUIDE.md](./EXECUTABLE_BUILD_GUIDE.md) for build issues
- Check backend logs: `/var/log/supervisor/backend.err.log`
- Check frontend logs: `/var/log/supervisor/frontend.err.log`

## 📝 License

ISC License

---

**Version**: 1.0.0  
**Last Updated**: November 2025  
**Tech Stack**: React 19, Node.js/Express, Tailwind CSS, shadcn/ui, Electron
