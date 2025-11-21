# Fraud Detection System - Deployment Configuration
# This file contains deployment scripts and configurations for different environments

# Build Scripts for Different Environments
build:dev:
	@echo "Building for development..."
	@cp .env.development .env.local
	@npm run build
	@echo "Development build complete"

build:staging:
	@echo "Building for staging..."
	@cp .env.staging .env.local
	@npm run build
	@echo "Staging build complete"

build:prod:
	@echo "Building for production..."
	@cp .env.production .env.local
	@npm run build
	@echo "Production build complete"

# Docker Configuration
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ARG VITE_ENVIRONMENT=production
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Nginx Configuration for Production
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
    }

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # API proxy (if needed)
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Environment Validation Script
#!/bin/bash
validate_environment() {
    echo "Validating environment configuration..."
    
    # Required environment variables
    REQUIRED_VARS=(
        "VITE_SUPABASE_URL"
        "VITE_SUPABASE_ANON_KEY"
        "VITE_FRAUD_API_ENDPOINT"
        "VITE_ENVIRONMENT"
    )
    
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -ne 0 ]; then
        echo "Missing required environment variables:"
        printf '   - %s\n' "${MISSING_VARS[@]}"
        echo "Please set these variables before deployment."
        exit 1
    fi
    
    echo "Environment validation passed"
}

# Security Check Script
#!/bin/bash
security_check() {
    echo "Running security checks..."
    
    # Check for default/demo credentials
    if [[ "$VITE_SUPABASE_URL" == *"your-project"* ]]; then
        echo "Default Supabase URL detected. Please update with actual credentials."
        exit 1
    fi
    
    if [[ "$VITE_SUPABASE_ANON_KEY" == *"your-"* ]]; then
        echo "Default Supabase key detected. Please update with actual credentials."
        exit 1
    fi
    
    # Check environment-specific security
    if [ "$VITE_ENVIRONMENT" = "production" ]; then
        if [ "$VITE_ENABLE_BETA_FEATURES" = "true" ]; then
            echo "Warning: Beta features enabled in production"
        fi
        
        if [ -z "$VITE_ERROR_REPORTING_ENDPOINT" ]; then
            echo "Warning: Error reporting not configured for production"
        fi
    fi
    
    echo "Security checks completed"
}

# Performance Optimization Check
#!/bin/bash
performance_check() {
    echo "Running performance checks..."
    
    # Check bundle size
    if [ -f "dist/assets/index-*.js" ]; then
        BUNDLE_SIZE=$(stat -f%z dist/assets/index-*.js 2>/dev/null || stat -c%s dist/assets/index-*.js)
        BUNDLE_SIZE_MB=$((BUNDLE_SIZE / 1024 / 1024))
        
        if [ $BUNDLE_SIZE_MB -gt 1 ]; then
            echo "Warning: Large bundle size detected: ${BUNDLE_SIZE_MB}MB"
            echo "   Consider code splitting or lazy loading"
        else
            echo "Bundle size acceptable: ${BUNDLE_SIZE_MB}MB"
        fi
    fi
    
    # Check if assets are compressed
    if [ -f "dist/assets/index-*.css" ]; then
        echo "CSS assets found"
    fi
    
    echo "Performance checks completed"
}

# Complete deployment pipeline
deploy() {
    echo "Starting deployment pipeline..."
    
    validate_environment
    security_check
    
    case "$1" in
        "dev")
            make build:dev
            ;;
        "staging")
            make build:staging
            ;;
        "prod")
            make build:prod
            performance_check
            ;;
        *)
            echo "Usage: deploy [dev|staging|prod]"
            exit 1
            ;;
    esac
    
    echo "Deployment pipeline completed successfully"
}

# Health check endpoint for monitoring
health_check() {
    echo "Application health check..."
    
    # Check if build directory exists
    if [ ! -d "dist" ]; then
        echo "Build directory not found"
        return 1
    fi
    
    # Check if index.html exists
    if [ ! -f "dist/index.html" ]; then
        echo "index.html not found"
        return 1
    fi
    
    # Check if assets exist
    if [ ! -d "dist/assets" ]; then
        echo "Assets directory not found"
        return 1
    fi
    
    echo "Application health check passed"
    return 0
}

# Monitoring and logging configuration
monitoring_setup() {
    echo "Setting up monitoring..."
    
    # Create monitoring directories
    mkdir -p logs
    mkdir -p monitoring
    
    # Log rotation configuration
    cat > logrotate.conf << EOF
/var/log/fraud-detection/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
EOF
    
    echo "Monitoring setup completed"
}

# Database migration check (if applicable)
db_check() {
    echo "Checking database connectivity..."
    
    if [ -n "$VITE_SUPABASE_URL" ]; then
        # Simple connectivity check
        curl -s "$VITE_SUPABASE_URL/rest/v1/" > /dev/null
        if [ $? -eq 0 ]; then
            echo "Database connectivity verified"
        else
            echo "Database connectivity failed"
            return 1
        fi
    fi
    
    return 0
}

# Backup configuration
backup_config() {
    echo "Creating configuration backup..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup environment files
    cp .env* "$BACKUP_DIR/" 2>/dev/null || true
    
    # Backup package files
    cp package*.json "$BACKUP_DIR/"
    
    # Backup configuration files
    cp *.config.* "$BACKUP_DIR/" 2>/dev/null || true
    
    echo "Configuration backed up to $BACKUP_DIR"
}

# Main deployment function
main() {
    case "$1" in
        "validate")
            validate_environment
            ;;
        "security")
            security_check
            ;;
        "performance")
            performance_check
            ;;
        "health")
            health_check
            ;;
        "monitoring")
            monitoring_setup
            ;;
        "backup")
            backup_config
            ;;
        "db-check")
            db_check
            ;;
        "deploy")
            deploy "$2"
            ;;
        *)
            echo "Fraud Detection System Deployment Tools"
            echo ""
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  validate     - Validate environment configuration"
            echo "  security     - Run security checks"
            echo "  performance  - Check build performance"
            echo "  health       - Application health check"
            echo "  monitoring   - Setup monitoring configuration"
            echo "  backup       - Backup current configuration"
            echo "  db-check     - Check database connectivity"
            echo "  deploy [env] - Deploy to environment (dev|staging|prod)"
            echo ""
            ;;
    esac
}

# Execute main function if script is run directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi