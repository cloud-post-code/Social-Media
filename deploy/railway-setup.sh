#!/bin/bash

# Railway Deployment Setup Script
# This script automates as much of the Railway deployment process as possible

set -e

echo "🚂 Railway Deployment Setup Agent"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        echo -e "${YELLOW}⚠️  Railway CLI not found. Installing...${NC}"
        npm install -g @railway/cli
        echo -e "${GREEN}✅ Railway CLI installed${NC}"
    else
        echo -e "${GREEN}✅ Railway CLI found${NC}"
    fi
}

# Login to Railway
login_railway() {
    echo -e "${BLUE}📝 Logging into Railway...${NC}"
    railway login
    echo -e "${GREEN}✅ Logged into Railway${NC}"
}

# Create new project or link to existing
setup_project() {
    echo -e "${BLUE}🔗 Setting up Railway project...${NC}"
    echo "Choose an option:"
    echo "1) Create a new Railway project"
    echo "2) Link to existing project"
    read -p "Enter choice (1 or 2): " choice
    
    if [ "$choice" == "1" ]; then
        railway init
        echo -e "${GREEN}✅ New Railway project created${NC}"
    else
        railway link
        echo -e "${GREEN}✅ Linked to existing Railway project${NC}"
    fi
}

# Add PostgreSQL database
setup_database() {
    echo -e "${BLUE}🗄️  Setting up PostgreSQL database...${NC}"
    echo "Please add PostgreSQL database manually in Railway dashboard:"
    echo "1. Go to Railway dashboard"
    echo "2. Click '+ New' → Database → Add PostgreSQL"
    echo "3. Copy the DATABASE_URL from the PostgreSQL service variables"
    echo ""
    read -p "Press Enter when PostgreSQL is set up..."
    
    # Get DATABASE_URL from Railway
    echo -e "${BLUE}📋 Getting DATABASE_URL from Railway...${NC}"
    DATABASE_URL=$(railway variables --json | jq -r '.[] | select(.name=="DATABASE_URL") | .value' || echo "")
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${YELLOW}⚠️  Could not automatically get DATABASE_URL${NC}"
        read -p "Enter DATABASE_URL manually: " DATABASE_URL
    fi
    
    echo -e "${GREEN}✅ Database URL configured${NC}"
}

# Setup backend service
setup_backend() {
    echo -e "${BLUE}⚙️  Setting up backend service...${NC}"
    
    cd backend
    
    # Set environment variables
    echo -e "${BLUE}📝 Setting backend environment variables...${NC}"
    
    # Link DATABASE_URL from PostgreSQL service
    echo "Linking DATABASE_URL from PostgreSQL service..."
    railway variables --service backend set DATABASE_URL="$DATABASE_URL" || true
    
    # Get GEMINI_API_KEY
    read -p "Enter your GEMINI_API_KEY: " GEMINI_API_KEY
    railway variables --service backend set GEMINI_API_KEY="$GEMINI_API_KEY"
    
    # Set NODE_ENV
    railway variables --service backend set NODE_ENV="production"
    
    echo -e "${GREEN}✅ Backend environment variables set${NC}"
    
    # Deploy backend
    echo -e "${BLUE}🚀 Deploying backend...${NC}"
    railway up --service backend
    
    cd ..
}

# Setup frontend service
setup_frontend() {
    echo -e "${BLUE}🎨 Setting up frontend service...${NC}"
    
    # Get backend URL
    echo -e "${BLUE}📋 Getting backend URL...${NC}"
    BACKEND_URL=$(railway status --service backend --json | jq -r '.url' || echo "")
    
    if [ -z "$BACKEND_URL" ]; then
        echo -e "${YELLOW}⚠️  Could not automatically get backend URL${NC}"
        read -p "Enter backend URL (e.g., https://your-backend.railway.app): " BACKEND_URL
    fi
    
    VITE_API_URL="${BACKEND_URL}/api"
    
    # Set frontend environment variables
    echo -e "${BLUE}📝 Setting frontend environment variables...${NC}"
    railway variables --service frontend set VITE_API_URL="$VITE_API_URL"
    
    echo -e "${GREEN}✅ Frontend environment variables set${NC}"
    
    # Deploy frontend
    echo -e "${BLUE}🚀 Deploying frontend...${NC}"
    railway up --service frontend
}

# Run database migrations
run_migrations() {
    echo -e "${BLUE}🔄 Running database migrations...${NC}"
    cd backend
    railway run npm run migrate
    cd ..
    echo -e "${GREEN}✅ Migrations completed${NC}"
}

# Main execution
main() {
    echo ""
    echo -e "${GREEN}Starting Railway deployment setup...${NC}"
    echo ""
    
    check_railway_cli
    login_railway
    setup_project
    setup_database
    setup_backend
    run_migrations
    setup_frontend
    
    echo ""
    echo -e "${GREEN}🎉 Railway deployment setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check your Railway dashboard for service URLs"
    echo "2. Test backend: curl https://your-backend.railway.app/health"
    echo "3. Visit your frontend URL"
    echo ""
}

# Run main function
main

