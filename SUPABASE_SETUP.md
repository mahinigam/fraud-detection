# Supabase Setup Guide
## Fraud Detection System Authentication Setup

### Prerequisites
- Supabase account (https://supabase.com)
- Node.js and npm installed
- Basic understanding of PostgreSQL

### Quick Start (5 Steps)

#### 1. **Create Supabase Project**
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization and project name: `fraud-detection-system`
4. Set database password (save this securely)
5. Select region closest to your users
6. Click "Create new project"

#### 2. **Get Project Credentials**
1. Go to Project Settings → API
2. Copy your project URL and anon key:
   ```
   Project URL: https://your-project-ref.supabase.co
   Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

#### 3. **Configure Environment Variables**
1. In your frontend folder, create `.env.local`:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_APP_NAME=Fraud Detection System
   VITE_APP_VERSION=1.0.0
   ```

#### 4. **Set Up Database Schema**
1. In Supabase Dashboard, go to "SQL Editor"
2. Copy the entire content from `database/schema.sql`
3. Paste it into a new query and click "Run"
4. Verify tables were created in "Table Editor"

#### 5. **Create Demo Users**
In Supabase Dashboard, go to Authentication → Users → Add User:

**Admin User:**
- Email: `admin@frauddetection.com`
- Password: `admin123`
- Email Confirm: Enabled

**Analyst User:**
- Email: `analyst@frauddetection.com` 
- Password: `analyst123`
- Email Confirm: Enabled

**Auditor User:**
- Email: `auditor@frauddetection.com`
- Password: `auditor123`
- Email Confirm: Enabled

### Database Configuration

#### Row Level Security (RLS)
Our schema automatically enables RLS with these policies:
- Users can only see their own data (unless admin/auditor)
- Admins have full access to all resources
- Auditors can view jobs and audit logs (read-only)
- Analysts can create/manage their own detection jobs

#### Authentication Settings
1. Go to Authentication → Settings
2. Enable email confirmations: **Disabled** (for demo)
3. Enable email change confirmations: **Enabled**
4. Site URL: `http://localhost:3000` (development)

### Frontend Integration

#### Install Dependencies
```bash
cd frontend
npm install @supabase/supabase-js
```

#### Key Files Created
- `src/lib/supabase.ts` - Supabase client and helpers
- `src/contexts/AuthContext.tsx` - Authentication context
- `src/components/LoginForm.tsx` - Login interface
- Updated `src/App.tsx` - Auth integration
- Updated `src/components/Sidebar.tsx` - Role-based UI

### Testing Authentication

#### 1. Start Development Server
```bash
cd frontend
npm run dev
```

#### 2. Test Login Flow
1. Visit `http://localhost:3000`
2. Click "Show Demo Accounts"
3. Click any demo account to auto-login
4. Verify role-based sidebar navigation
5. Test logout functionality

#### 3. Verify Database
1. Check Supabase Dashboard → Authentication → Users
2. Verify user profiles in Table Editor → users table
3. Test creating fraud detection jobs
4. Check audit logs are being created

### Role-Based Features

#### **Admin** (`admin@frauddetection.com`)
- Full dashboard access
- User management
- System settings
- Audit logs viewer
- All fraud detection features

#### **Analyst** (`analyst@frauddetection.com`)
- Dashboard and analytics
- Risk scoring and detection
- Transaction analysis
- Own job management

#### **Auditor** (`auditor@frauddetection.com`)
- Dashboard (read-only)
- Audit logs access
- Reports and analytics
- No job creation/editing

### Troubleshooting

#### Common Issues

**"Invalid login credentials"**
- Solution: Verify demo users were created in Supabase Auth
- Check email/password match exactly
- Ensure email confirmation is disabled

**"Property 'env' does not exist on type 'ImportMeta'"**
- Solution: Ensure `.env.local` file exists with correct variables
- Restart development server after adding env vars

**"Failed to fetch"**  
- Solution: Check VITE_SUPABASE_URL is correct
- Verify network connectivity to Supabase
- Check browser console for CORS issues

**RLS Policy Violations**
- Solution: Verify user profiles exist in `users` table
- Check user roles are set correctly
- Review RLS policies in Supabase

#### Debug Steps
1. Open browser DevTools → Network tab
2. Check Supabase requests/responses
3. Verify environment variables: `console.log(import.meta.env)`
4. Check authentication state in React DevTools

### Production Deployment

#### Environment Variables
Update for production:
```env
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key
VITE_APP_NAME=Fraud Detection System
```

#### Security Checklist
- [ ] Enable email confirmations
- [ ] Set production site URL
- [ ] Update CORS settings
- [ ] Enable additional auth providers (optional)
- [ ] Set up custom SMTP (optional)
- [ ] Configure rate limiting
- [ ] Review RLS policies

### Monitoring & Analytics

#### Supabase Dashboard
- Authentication → Users: Monitor user registrations
- Database → Tables: Check data integrity  
- API → Logs: Review API usage and errors
- Settings → Billing: Monitor usage limits

#### Application Metrics
The schema includes analytics views:
- `user_activity_stats` - User engagement metrics
- `system_metrics` - Overall system health
- Real-time job progress tracking
- Comprehensive audit trails

### Next Steps

With authentication working, you can now:

1. **Test Role-Based Access** - Login as different users
2. **Implement Job Management** - Real-time progress tracking
3. **Add Admin Components** - User management interface
4. **Set Up Notifications** - Real-time alerts and updates
5. **Write Tests** - Authentication and role-based flows
6. **Deploy to Production** - With proper security settings

### Support

If you encounter issues:
1. Check this guide first
2. Review Supabase documentation: https://supabase.com/docs
3. Check browser console and network requests
4. Verify database schema and RLS policies
5. Test with minimal reproduction case

---

**Congratulations!** Your fraud detection system now has enterprise-grade authentication with role-based access control, audit logging, and real-time capabilities!