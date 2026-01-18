#!/usr/bin/env node

/**
 * Railway Deployment Setup Agent
 * Automates Railway deployment configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  step: (msg) => console.log(`\n${colors.blue}📦 ${msg}${colors.reset}`)
};

async function checkRailwayCLI() {
  try {
    execSync('railway --version', { stdio: 'ignore' });
    log.success('Railway CLI found');
    return true;
  } catch (error) {
    log.warn('Railway CLI not found. Installing...');
    try {
      execSync('npm install -g @railway/cli', { stdio: 'inherit' });
      log.success('Railway CLI installed');
      return true;
    } catch (installError) {
      log.error('Failed to install Railway CLI. Please install manually: npm install -g @railway/cli');
      return false;
    }
  }
}

async function loginRailway() {
  log.step('Logging into Railway...');
  try {
    execSync('railway login', { stdio: 'inherit' });
    log.success('Logged into Railway');
    return true;
  } catch (error) {
    log.error('Failed to login to Railway');
    return false;
  }
}

async function setupProject() {
  log.step('Setting up Railway project...');
  const choice = await question('Create new project (1) or link to existing (2)? ');
  
  try {
    if (choice === '1') {
      execSync('railway init', { stdio: 'inherit' });
      log.success('New Railway project created');
    } else {
      execSync('railway link', { stdio: 'inherit' });
      log.success('Linked to existing Railway project');
    }
    return true;
  } catch (error) {
    log.error('Failed to setup project');
    return false;
  }
}

async function getDatabaseURL() {
  log.step('Getting DATABASE_URL from Railway...');
  try {
    const output = execSync('railway variables --json', { encoding: 'utf-8' });
    const variables = JSON.parse(output);
    const dbUrl = variables.find(v => v.name === 'DATABASE_URL')?.value;
    
    if (dbUrl) {
      log.success('Found DATABASE_URL');
      return dbUrl;
    }
  } catch (error) {
    // Continue to manual input
  }
  
  log.warn('Could not automatically get DATABASE_URL');
  const dbUrl = await question('Enter DATABASE_URL manually: ');
  return dbUrl;
}

async function setupBackend(geminiApiKey) {
  log.step('Setting up backend service...');
  
  const backendDir = path.join(process.cwd(), 'backend');
  if (!fs.existsSync(backendDir)) {
    log.error('Backend directory not found');
    return false;
  }
  
  process.chdir(backendDir);
  
  try {
    // Set environment variables
    log.info('Setting backend environment variables...');
    
    const dbUrl = await getDatabaseURL();
    execSync(`railway variables set DATABASE_URL="${dbUrl}"`, { stdio: 'inherit' });
    execSync(`railway variables set GEMINI_API_KEY="${geminiApiKey}"`, { stdio: 'inherit' });
    execSync('railway variables set NODE_ENV=production', { stdio: 'inherit' });
    
    log.success('Backend environment variables set');
    
    // Deploy backend
    log.info('Deploying backend...');
    execSync('railway up', { stdio: 'inherit' });
    
    log.success('Backend deployed');
    process.chdir('..');
    return true;
  } catch (error) {
    log.error('Failed to setup backend');
    process.chdir('..');
    return false;
  }
}

async function getBackendURL() {
  log.step('Getting backend URL...');
  try {
    const output = execSync('railway status --json', { encoding: 'utf-8' });
    const status = JSON.parse(output);
    return status.url || status.domain;
  } catch (error) {
    // Continue to manual input
  }
  
  log.warn('Could not automatically get backend URL');
  const url = await question('Enter backend URL (e.g., https://your-backend.railway.app): ');
  return url;
}

async function setupFrontend() {
  log.step('Setting up frontend service...');
  
  const backendUrl = await getBackendURL();
  const viteApiUrl = `${backendUrl}/api`;
  
  try {
    log.info('Setting frontend environment variables...');
    execSync(`railway variables set VITE_API_URL="${viteApiUrl}"`, { stdio: 'inherit' });
    
    log.success('Frontend environment variables set');
    
    log.info('Deploying frontend...');
    execSync('railway up', { stdio: 'inherit' });
    
    log.success('Frontend deployed');
    return true;
  } catch (error) {
    log.error('Failed to setup frontend');
    return false;
  }
}

async function runMigrations() {
  log.step('Running database migrations...');
  
  const backendDir = path.join(process.cwd(), 'backend');
  process.chdir(backendDir);
  
  try {
    execSync('railway run npm run migrate', { stdio: 'inherit' });
    log.success('Migrations completed');
    process.chdir('..');
    return true;
  } catch (error) {
    log.error('Failed to run migrations');
    process.chdir('..');
    return false;
  }
}

async function main() {
  console.log('\n🚂 Railway Deployment Setup Agent\n');
  console.log('==================================\n');
  
  // Check Railway CLI
  const hasCLI = await checkRailwayCLI();
  if (!hasCLI) {
    process.exit(1);
  }
  
  // Login
  const loggedIn = await loginRailway();
  if (!loggedIn) {
    process.exit(1);
  }
  
  // Setup project
  const projectSetup = await setupProject();
  if (!projectSetup) {
    process.exit(1);
  }
  
  // Get Gemini API key
  log.step('Gemini API Key required');
  const geminiApiKey = await question('Enter your GEMINI_API_KEY: ');
  
  // Setup backend
  const backendSetup = await setupBackend(geminiApiKey);
  if (!backendSetup) {
    log.warn('Backend setup had issues, but continuing...');
  }
  
  // Run migrations
  await runMigrations();
  
  // Setup frontend
  await setupFrontend();
  
  console.log('\n🎉 Railway deployment setup complete!\n');
  console.log('Next steps:');
  console.log('1. Check your Railway dashboard for service URLs');
  console.log('2. Test backend: curl https://your-backend.railway.app/health');
  console.log('3. Visit your frontend URL\n');
  
  rl.close();
}

main().catch((error) => {
  log.error(`Setup failed: ${error.message}`);
  process.exit(1);
});

