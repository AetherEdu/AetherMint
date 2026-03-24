# Plagiarism Detection Service Documentation

## Overview

The Plagiarism Detection Service is a sophisticated AI-powered system designed to identify potential plagiarism in text submissions, code assignments, and other academic work. It provides comprehensive analysis capabilities including text similarity, code plagiarism detection, web content scanning, and academic database integration.

## Features

### Detection Engine
- **Text Similarity Analysis**: Advanced algorithms for detecting text plagiarism including n-gram analysis, cosine similarity, and semantic analysis
- **Code Plagiarism Detection**: AST-based, token-based, and structural similarity analysis for multiple programming languages
- **Cross-Language Source Comparison**: Detection across different programming languages and natural languages
- **Web Content Scanning**: Real-time scanning of web content using multiple search engines
- **Academic Database Integration**: Integration with major academic databases (PubMed, arXiv, Google Scholar, JSTOR, Scopus)
- **Machine Learning Pattern Recognition**: Continuous learning capabilities for improved detection accuracy

### Analysis Features
- **Similarity Percentage Calculation**: Precise similarity scoring with configurable thresholds
- **Source Identification and Citation**: Automatic source identification with proper citation formatting
- **Paraphrasing Detection**: Advanced semantic analysis to detect paraphrased content
- **Translation Plagiarism Detection**: Cross-language plagiarism detection
- **Patchwriting Identification**: Detection of patchwriting (close paraphrasing with minimal changes)
- **Originality Scoring**: Comprehensive originality scoring based on multiple factors

### Integration Points
- **Assignment Submission Integration**: Seamless integration with existing assignment systems
- **Real-time Analysis Capabilities**: Real-time processing with WebSocket support
- **Bulk Submission Processing**: Efficient batch processing capabilities
- **LMS System Integration**: Integration with Learning Management Systems
- **API for Third-party Tools**: RESTful API for external integrations
- **Report Generation System**: Comprehensive report generation with multiple formats

### Administrative Tools
- **Review and Moderation Interface**: Advanced review queue management
- **False Positive Management**: Tools for managing and learning from false positives
- **Customizable Sensitivity Settings**: Institution-specific configuration options
- **Academic Policy Enforcement**: Automated policy enforcement based on institutional rules
- **Appeal and Dispute Resolution**: Complete appeal workflow management
- **Analytics and Reporting**: Detailed analytics and performance metrics

## Architecture

### Core Components

1. **PlagiarismDetectionService**: Main service orchestrating all detection operations
2. **CodePlagiarismAnalyzer**: Specialized analyzer for code plagiarism detection
3. **WebContentScanner**: Service for scanning web content and academic databases
4. **PlagiarismAdministrativeService**: Administrative tools for review and moderation

### Data Models

The system uses comprehensive TypeScript interfaces for type safety:

- `PlagiarismReport`: Main report structure containing all analysis results
- `PlagiarismMatch`: Individual similarity matches with detailed metadata
- `PlagiarismSource`: Source information for matched content
- `PlagiarismSettings`: Configurable settings for detection parameters
- `PlagiarismAppeal`: Appeal workflow management

### Detection Methods

The system supports multiple detection methods:

- `TEXT_SIMILARITY`: Text-based similarity analysis
- `CODE_SIMILARITY`: Code structure and token similarity
- `WEB_SCANNING`: Web content comparison
- `ACADEMIC_DATABASE`: Academic database search
- `PARAPHRASING`: Semantic paraphrasing detection
- `TRANSLATION`: Cross-language detection
- `PATCHWRITING`: Close paraphrasing detection

## API Documentation

### Base URL
```
https://api.starked-education.com/plagiarism
```

### Authentication
All API endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Analyze Single Submission
```http
POST /api/plagiarism/analyze
Content-Type: application/json

{
  "submissionId": "uuid-string",
  "content": "text or code content to analyze",
  "contentType": "text|code|mixed",
  "language": "en",
  "codeLanguage": "javascript|python|java|cpp|csharp|php|ruby|go|rust|typescript",
  "sensitivity": "low|medium|high",
  "includeWebScanning": true,
  "includeAcademicDatabase": true,
  "includeInternalComparison": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "uuid-string",
    "status": "completed",
    "overallSimilarity": 25.5,
    "originalityScore": 74.5,
    "matches": [
      {
        "id": "uuid-string",
        "source": {
          "type": "web",
          "title": "Source Title",
          "url": "https://example.com",
          "confidence": 0.85
        },
        "similarityPercentage": 85.2,
        "detectionMethod": "text_similarity",
        "isParaphrased": false
      }
    ],
    "processingTime": 2.3,
    "needsReview": false
  }
}
```

#### Batch Analysis
```http
POST /api/plagiarism/batch-analyze
Content-Type: application/json

{
  "submissions": [
    {
      "submissionId": "uuid-1",
      "content": "content 1",
      "contentType": "text"
    },
    {
      "submissionId": "uuid-2", 
      "content": "content 2",
      "contentType": "code",
      "codeLanguage": "python"
    }
  ],
  "settings": {
    "sensitivityLevel": "medium",
    "minimumSimilarityThreshold": 15
  }
}
```

#### Get Report
```http
GET /api/plagiarism/reports/{reportId}
```

#### Get Settings
```http
GET /api/plagiarism/settings
```

#### Update Settings
```http
PUT /api/plagiarism/settings
Content-Type: application/json

{
  "sensitivityLevel": "medium",
  "minimumSimilarityThreshold": 15,
  "enableWebScanning": true,
  "enableAcademicDatabase": true,
  "autoFlagThreshold": 25,
  "reviewRequiredThreshold": 40
}
```

#### Get Analytics
```http
GET /api/plagiarism/analytics?startDate=2023-01-01&endDate=2023-12-31
```

#### Submit Appeal
```http
POST /api/plagiarism/appeal
Content-Type: application/json

{
  "reportId": "uuid-string",
  "reason": "False positive",
  "explanation": "Detailed explanation of why this is a false positive",
  "evidence": ["evidence1", "evidence2"]
}
```

## Integration Guide

### JavaScript/Node.js Integration

```javascript
const axios = require('axios');

class PlagiarismDetectionClient {
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async analyzeSubmission(submission) {
    try {
      const response = await this.client.post('/analyze', submission);
      return response.data;
    } catch (error) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  async getReport(reportId) {
    try {
      const response = await this.client.get(`/reports/${reportId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get report: ${error.message}`);
    }
  }
}

// Usage
const client = new PlagiarismDetectionClient('your-api-key', 'https://api.starked-education.com');

const submission = {
  submissionId: 'unique-id',
  content: 'Your text or code content here',
  contentType: 'text',
  language: 'en',
  sensitivity: 'medium'
};

client.analyzeSubmission(submission)
  .then(result => {
    console.log('Analysis result:', result);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### Python Integration

```python
import requests
import json

class PlagiarismDetectionClient:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def analyze_submission(self, submission):
        try:
            response = requests.post(
                f'{self.base_url}/analyze',
                headers=self.headers,
                json=submission
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f'Analysis failed: {e}')

    def get_report(self, report_id):
        try:
            response = requests.get(
                f'{self.base_url}/reports/{report_id}',
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f'Failed to get report: {e}')

# Usage
client = PlagiarismDetectionClient(
    'your-api-key',
    'https://api.starked-education.com'
)

submission = {
    'submissionId': 'unique-id',
    'content': 'Your text or code content here',
    'contentType': 'text',
    'language': 'en',
    'sensitivity': 'medium'
}

try:
    result = client.analyze_submission(submission)
    print('Analysis result:', result)
except Exception as e:
    print('Error:', e)
```

### LMS Integration (Canvas Example)

```javascript
// Canvas LMS Integration Example
const canvas = require('canvas-api');
const PlagiarismClient = require('./plagiarism-client');

class CanvasPlagiarismIntegration {
  constructor(canvasToken, plagiarismApiKey) {
    this.canvas = new canvas(canvasToken);
    this.plagiarismClient = new PlagiarismClient(plagiarismApiKey);
  }

  async analyzeAssignmentSubmission(courseId, assignmentId, submissionId) {
    try {
      // Get submission from Canvas
      const submission = await this.canvas.getSubmission(courseId, assignmentId, submissionId);
      
      // Prepare for plagiarism analysis
      const analysisRequest = {
        submissionId: submission.id,
        content: submission.body || submission.attachments[0]?.url,
        contentType: this.detectContentType(submission),
        language: 'en',
        codeLanguage: this.detectCodeLanguage(submission)
      };

      // Analyze for plagiarism
      const result = await this.plagiarismClient.analyzeSubmission(analysisRequest);

      // Store results in Canvas
      await this.canvas.addComment(courseId, assignmentId, submissionId, {
        comment: `Plagiarism analysis completed. Similarity: ${result.overallSimilarity}%`,
        attachment: this.generateReport(result)
      });

      return result;
    } catch (error) {
      console.error('Canvas integration error:', error);
      throw error;
    }
  }

  detectContentType(submission) {
    // Logic to detect content type based on submission
    if (submission.body && !submission.body.includes('function')) {
      return 'text';
    } else if (submission.body && submission.body.includes('function')) {
      return 'code';
    }
    return 'mixed';
  }

  detectCodeLanguage(submission) {
    // Logic to detect programming language
    const content = submission.body || '';
    if (content.includes('def ') || content.includes('import ')) return 'python';
    if (content.includes('function ') || content.includes('const ')) return 'javascript';
    if (content.includes('public class ')) return 'java';
    return null;
  }
}
```

## Configuration

### Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/starked_education
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

# Plagiarism Detection Settings
DEFAULT_SENSITIVITY=medium
DEFAULT_SIMILARITY_THRESHOLD=15
ENABLE_WEB_SCANNING=true
ENABLE_ACADEMIC_DATABASE=true

# External API Keys
GOOGLE_SEARCH_API_KEY=your-google-search-api-key
BING_SEARCH_API_KEY=your-bing-search-api-key
PUBMED_API_KEY=your-pubmed-api-key
ARXIV_API_KEY=your-arxiv-api-key

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/plagiarism.log
```

### Settings Configuration

```json
{
  "plagiarismDetection": {
    "sensitivityLevel": "medium",
    "minimumSimilarityThreshold": 15,
    "enableWebScanning": true,
    "enableAcademicDatabase": true,
    "enableInternalComparison": true,
    "enableParaphrasingDetection": true,
    "enableTranslationDetection": false,
    "excludedDomains": ["wikipedia.org", "stackoverflow.com"],
    "trustedSources": ["edu", "gov", "org"],
    "autoFlagThreshold": 25,
    "reviewRequiredThreshold": 40,
    "supportedLanguages": ["en", "es", "fr", "de", "zh", "ja"],
    "supportedCodeLanguages": [
      "javascript", "python", "java", "cpp", 
      "csharp", "php", "ruby", "go", "rust", "typescript"
    ]
  },
  "administrative": {
    "autoApproveThreshold": 10,
    "autoRejectThreshold": 85,
    "requireDualReview": true,
    "escalationThreshold": 70,
    "reviewTimeout": 48,
    "notificationSettings": {
      "email": true,
      "sms": false,
      "inApp": true
    }
  },
  "performance": {
    "cacheEnabled": true,
    "cacheExpiration": 86400,
    "batchSize": 50,
    "concurrentProcessing": 5,
    "timeout": 30000
  }
}
```

## Performance Considerations

### Optimization Strategies

1. **Caching**: Implement Redis caching for frequently analyzed content
2. **Batch Processing**: Use batch processing for multiple submissions
3. **Async Processing**: Implement background job processing for large files
4. **Rate Limiting**: Apply rate limiting to external API calls
5. **Database Optimization**: Use proper indexing and query optimization

### Scaling Recommendations

1. **Horizontal Scaling**: Deploy multiple instances behind a load balancer
2. **Database Scaling**: Use read replicas for analytics queries
3. **CDN Integration**: Use CDN for static report assets
4. **Queue Management**: Implement message queues for background processing

## Security Considerations

### Data Protection
- Encrypt all sensitive data at rest and in transit
- Implement proper access controls and authentication
- Regular security audits and penetration testing
- Compliance with GDPR and other data protection regulations

### API Security
- JWT-based authentication with proper expiration
- Rate limiting to prevent abuse
- Input validation and sanitization
- HTTPS enforcement for all API communications

## Monitoring and Analytics

### Key Metrics
- Detection accuracy rates
- False positive/negative rates
- Processing times and throughput
- API response times and error rates
- User satisfaction and appeal rates

### Logging
- Structured logging with correlation IDs
- Performance metrics and error tracking
- Audit logs for administrative actions
- Integration with monitoring systems (Prometheus, Grafana)

## Troubleshooting

### Common Issues

1. **High Processing Times**: Check network connectivity and external API status
2. **False Positives**: Adjust sensitivity settings and excluded domains
3. **Memory Issues**: Implement streaming for large files and increase memory limits
4. **API Rate Limits**: Implement proper rate limiting and caching strategies

### Debug Mode

Enable debug logging for detailed troubleshooting:
```bash
LOG_LEVEL=debug npm start
```

## Support and Maintenance

### Regular Maintenance
- Update detection algorithms and models
- Refresh academic database connections
- Monitor and update external API integrations
- Performance tuning and optimization

### Support Channels
- Technical documentation and API reference
- Community support forums
- Enterprise support packages available
- Regular training and webinars

## Future Enhancements

### Planned Features
- Advanced AI/ML model integration
- Real-time collaboration detection
- Mobile application support
- Advanced analytics dashboard
- Integration with more academic databases

### Research and Development
- Continuous improvement of detection algorithms
- Research into new plagiarism techniques
- Collaboration with academic institutions
- Open-source contributions and community involvement
