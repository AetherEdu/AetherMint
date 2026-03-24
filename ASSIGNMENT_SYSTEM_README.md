# Assignment Submission and Grading System

A comprehensive assignment management system built for the StarkEd Education platform that handles various submission types, grading workflows, and feedback management with plagiarism detection capabilities.

## 🎯 Features

### Submission Management
- **Multiple Submission Types**: Text, file uploads, code submissions, video/audio, and multiple files
- **Rich Text Editor**: WYSIWYG editor for text submissions with formatting options
- **File Upload System**: Secure file handling with validation, virus scanning, and size limits
- **Code Submissions**: Syntax highlighting and execution sandbox for programming assignments
- **Draft Saving**: Auto-save and manual draft functionality
- **Late Submission Handling**: Configurable late policies with automatic penalty calculation

### Grading Workflow
- **Rubric-Based Grading**: Customizable rubrics with criteria and performance levels
- **Inline Comments**: Add annotations and comments directly on submissions
- **Grade Calculation**: Automatic percentage and letter grade calculation
- **Bulk Grading**: Apply grading operations to multiple submissions at once
- **Grade Appeals**: Student appeal system with review workflow
- **Grade Release Scheduling**: Control when grades are visible to students

### Backend Processing
- **File Validation**: Comprehensive security checks and file type validation
- **Plagiarism Detection**: Automated similarity analysis with detailed reporting
- **Code Execution**: Secure sandboxed code execution for programming assignments
- **Auto-Grading**: Automated grading for objective assignments
- **Grade Calculation Engine**: Advanced grade weighting and calculation
- **Notification System**: Real-time notifications for grades and deadlines

### Frontend Interface
- **Assignment Portal**: Modern, responsive submission interface
- **Drag-and-Drop**: Intuitive file upload with progress indicators
- **Code Editor**: Monaco/CodeMirror integration with syntax highlighting
- **Grade Viewer**: Comprehensive grade display with feedback
- **Assignment History**: Track submission history and progress

### Collaboration Features
- **Group Assignments**: Support for collaborative submissions
- **Peer Review**: Student-to-student review system
- **Discussion Threads**: Assignment-specific discussions
- **Version Control**: Track changes and revisions

## 🏗️ Architecture

### Backend Services

#### Assignment Service (`assignmentService.ts`)
- Assignment CRUD operations
- Submission management
- Statistics and analytics
- Student progress tracking

#### Grading Service (`assignmentGradingService.ts`)
- Grade creation and management
- Rubric evaluation
- Appeal processing
- Bulk operations

#### File Upload Service (`fileUploadService.ts`)
- Secure file storage (AWS S3)
- File validation and processing
- Image optimization
- Thumbnail generation

#### Plagiarism Service (`plagiarismService.ts`)
- Similarity analysis
- Source matching
- Report generation
- Batch processing

#### Code Execution Service (`codeExecutionService.ts`)
- Sandboxed code execution
- Multi-language support
- Security validation
- Test case execution

#### Notification Service (`assignmentNotificationService.ts`)
- Multi-channel notifications
- Template management
- Scheduling
- User preferences

### Frontend Components

#### Assignment Submission (`AssignmentSubmission.tsx`)
- Multi-type submission interface
- File upload with drag-and-drop
- Real-time validation
- Auto-save functionality

#### Grading Interface (`GradingInterface.tsx`)
- Comprehensive grading dashboard
- Rubric-based evaluation
- Annotation tools
- Feedback management

## 📋 API Endpoints

### Assignment Management
```
POST   /api/courses/:courseId/assignments     # Create assignment
GET    /api/courses/:courseId/assignments     # List assignments
GET    /api/assignments/:assignmentId          # Get assignment
PUT    /api/assignments/:assignmentId          # Update assignment
DELETE /api/assignments/:assignmentId          # Delete assignment
```

### Submission Management
```
POST   /api/assignments/:assignmentId/submissions    # Create submission
GET    /api/assignments/:assignmentId/submissions    # List submissions
GET    /api/submissions/:submissionId               # Get submission
PUT    /api/submissions/:submissionId               # Update submission
POST   /api/submissions/:submissionId/submit        # Submit assignment
```

### Grading Management
```
POST   /api/submissions/:submissionId/grade         # Grade submission
GET    /api/assignments/:assignmentId/grades         # List grades
GET    /api/assignments/:assignmentId/stats           # Assignment statistics
POST   /api/assignments/:assignmentId/bulk-grade     # Bulk grading
```

### File Management
```
POST   /api/files/upload                             # Upload files
GET    /api/files/:fileId                           # Get file
DELETE /api/files/:fileId                           # Delete file
POST   /api/files/:fileId/thumbnail                 # Generate thumbnail
```

## 🔧 Configuration

### Environment Variables
```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=starked-education-files

# Database Configuration
DATABASE_URL=your_database_url

# JWT Configuration
JWT_SECRET=your_jwt_secret

# Plagiarism Detection
PLAGIARISM_API_KEY=your_plagiarism_api_key
PLAGIARISM_SERVICE_URL=https://api.plagiarism.service

# Code Execution
CODE_EXECUTION_TIMEOUT=5000
CODE_EXECUTION_MEMORY_LIMIT=128
```

### Assignment Types
```typescript
export enum AssignmentType {
  QUIZ = 'quiz',
  ESSAY = 'essay',
  CODE = 'code',
  PROJECT = 'project',
  VIDEO = 'video',
  FILE_UPLOAD = 'file_upload',
  TEXT_SUBMISSION = 'text_submission'
}
```

### Submission Types
```typescript
export enum SubmissionType {
  TEXT = 'text',
  FILE = 'file',
  CODE = 'code',
  VIDEO = 'video',
  AUDIO = 'audio',
  MULTIPLE_FILES = 'multiple_files'
}
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test assignment.test.ts

# Watch mode
npm run test:watch
```

### Test Coverage
The test suite covers:
- Assignment creation and management
- Submission workflows
- Grading operations
- File upload handling
- Code execution
- Plagiarism detection
- Notification systems

### Test Structure
```
tests/
├── assignment.test.ts      # Main assignment system tests
├── grading.test.ts         # Grading workflow tests
├── fileUpload.test.ts      # File upload tests
├── plagiarism.test.ts      # Plagiarism detection tests
└── integration/            # Integration tests
    ├── end-to-end.test.ts
    └── performance.test.ts
```

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL or MongoDB
- Redis for caching
- AWS S3 for file storage
- Docker (for code execution sandbox)

### Installation
```bash
# Install dependencies
npm run install:all

# Build the application
npm run build

# Start development servers
npm run dev
```

### Production Deployment
```bash
# Build for production
npm run build

# Start production servers
npm start

# Deploy with Docker
docker-compose up -d
```

## 📊 Performance Considerations

### File Upload Optimization
- Chunked uploads for large files
- Progress indicators
- Compression and optimization
- CDN integration

### Database Optimization
- Indexed queries for fast retrieval
- Pagination for large datasets
- Caching for frequently accessed data
- Connection pooling

### Code Execution Security
- Isolated Docker containers
- Resource limits (CPU, memory, time)
- Network restrictions
- Filesystem isolation

## 🔒 Security Features

### File Security
- Virus scanning integration
- File type validation
- Size limits
- Malicious code detection

### Code Execution Security
- Sandboxed environments
- Resource monitoring
- Timeout enforcement
- Output sanitization

### Data Protection
- Encrypted storage
- Secure file access
- User authentication
- Role-based permissions

## 📈 Analytics and Reporting

### Assignment Statistics
- Submission rates
- Grade distributions
- Late submission analysis
- Plagiarism detection rates

### Performance Metrics
- Average grading time
- System response times
- File upload speeds
- Code execution performance

## 🔄 Integration Points

### Learning Management Systems (LMS)
- Canvas integration
- Moodle compatibility
- Blackboard support
- Custom LMS APIs

### External Services
- Turnitin plagiarism detection
- AWS S3 storage
- Email services (SendGrid)
- Push notifications

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Husky for git hooks

## 📝 Documentation

### API Documentation
- OpenAPI/Swagger specifications
- Interactive API explorer
- Code examples
- Error handling

### User Documentation
- Student guide
- Instructor manual
- Administrator documentation
- FAQ section

## 🐛 Troubleshooting

### Common Issues
- File upload failures
- Code execution timeouts
- Plagiarism detection errors
- Notification delivery issues

### Debug Tools
- Application logs
- Performance monitoring
- Error tracking
- Health checks

## 📞 Support

### Getting Help
- GitHub issues for bug reports
- Documentation for guidance
- Community forums
- Email support

### Version History
- v1.0.0: Initial release
- v1.1.0: Added plagiarism detection
- v1.2.0: Enhanced code execution
- v1.3.0: Improved grading workflows

---

**Built with ❤️ for the StarkEd Education Platform**
