# AetherMint Education - Frontend

A modern, responsive web application for decentralized education built with Next.js 14, TypeScript, and Tailwind CSS.

## 🚀 Features

- **Profile Management Dashboard** - Complete user profile system with achievements, credentials, and statistics
- **Achievement System** - Gamified learning with rarity-based achievements
- **Credential Management** - Verification and management of educational credentials
- **Real-time Statistics** - Comprehensive learning analytics and progress tracking
- **Responsive Design** - Mobile-first design with dark mode support
- **Type Safety** - Full TypeScript implementation with strict mode
- **Error Handling** - Comprehensive error boundaries and graceful fallbacks
- **Testing** - Jest and React Testing Library setup


## 🛠 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5.1+
- **Styling**: Tailwind CSS 3.3
- **Icons**: Lucide React
- **Forms**: React Hook Form 7
- **Testing**: Jest + React Testing Library
- **Linting**: ESLint + TypeScript ESLint
- **Formatting**: Prettier
- **Containerization**: Docker


## 📦 Installation

1. Clone the repository
```bash
git clone https://github.com/your-org/aethermint-education.git
cd aethermint-education/frontend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Generate coverage report
```bash
npm run test:coverage
```

### Type checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Fix linting issues
```bash
npm run lint:fix
```

## 🏗 Build & Deployment

### Build for production
```bash
npm run build
```

### Start production server
```bash
npm start
```

### Docker deployment
```bash
# Build Docker image
docker build -t aethermint-education-frontend .

# Run container
docker run -p 3000:3000 aethermint-education-frontend
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── profile/           # Profile management page
│   │   ├── demo/              # Interactive demo
│   │   └── globals.css        # Global styles
│   ├── components/            # Reusable components
│   │   ├── ProfileEditor.tsx   # Profile editing form
│   │   ├── AchievementDisplay.tsx # Achievement showcase
│   │   ├── CredentialList.tsx  # Credential management
│   │   ├── ProfileStats.tsx    # Statistics dashboard
│   │   ├── ErrorBoundary.tsx   # Error boundary component
│   │   └── LoadingFallback.tsx # Loading states
│   ├── hooks/                 # Custom React hooks
│   │   └── useProfile.ts      # Profile data management
│   ├── types/                 # TypeScript type definitions
│   │   └── profile.ts         # Profile-related types
│   ├── test/                  # Test files
│   │   └── profile.test.tsx   # Profile component tests
│   └── test-profile.tsx       # Test data and utilities
├── public/                    # Static assets
├── docs/                      # Documentation
└── config files...
```

## 🎯 Profile Management Dashboard

The main feature of this application is the comprehensive Profile Management Dashboard, which includes:

### **Profile Editor**
- Edit personal information (name, email, bio, location, website)
- Avatar upload functionality
- Privacy settings management
- Form validation with react-hook-form

### **Achievement System**
- Multiple rarity levels (common, rare, epic, legendary)
- Progress tracking for incomplete achievements
- Category-based filtering and search
- Visual progress indicators

### **Credential Management**
- Multiple credential types (certificates, badges, degrees, licenses)
- Verification status tracking
- Skills tagging and organization
- External verification links

### **Statistics Dashboard**
- Course completion metrics
- Study streak tracking
- Global ranking and percentile
- Performance scoring system

## 🔧 Configuration

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENABLE_MOCK_DATA=true
```

### TypeScript Configuration
- Strict mode enabled
- Comprehensive type checking
- No implicit any
- Strict null checks

### ESLint Configuration
- Next.js recommended rules
- TypeScript ESLint plugin
- Custom rules for code quality

### Prettier Configuration
- Consistent code formatting
- 2-space indentation
- Single quotes
- Trailing commas

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main branch

### Docker
```bash
# Build and run with Docker
docker build -t aethermint-education-frontend .
docker run -p 3000:3000 aethermint-education-frontend
```

### Static Export
```bash
# Build static version
npm run build
npm run export
```

## 🧪 Development

### Code Quality
- TypeScript strict mode
- ESLint for code linting
- Prettier for code formatting
- Husky for git hooks
- Lint-staged for pre-commit checks

### Testing Strategy
- Unit tests for components
- Integration tests for user flows
- Mock implementations for external dependencies
- Coverage reporting

### Performance
- Next.js optimization
- Image optimization
- Code splitting
- Lazy loading

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Development Workflow
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Check types
npm run type-check

# Lint code
npm run lint

# Format code
npm run lint:fix
```

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the demo at `/demo`

## 🔗 Related Projects

- [AetherMint Backend](../backend/) - API and blockchain integration
- [AetherMint Contracts](../contracts/) - Smart contracts
- [AetherMint Documentation](../docs/) - Project documentation
