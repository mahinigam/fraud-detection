-- ===============================================
-- 🏢 Fraud Detection System Database Schema
-- Supabase PostgreSQL with Row Level Security
-- ===============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===============================================
-- 👤 USER MANAGEMENT
-- ===============================================

-- Create custom user roles enum
CREATE TYPE user_role AS ENUM ('admin', 'analyst', 'auditor');

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'analyst',
    department TEXT DEFAULT 'Security',
    avatar_url TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'),
    CONSTRAINT valid_phone CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$')
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- 📊 FRAUD DETECTION JOBS
-- ===============================================

-- Create job status enum
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Create fraud detection jobs table
CREATE TABLE IF NOT EXISTS public.fraud_detection_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status job_status DEFAULT 'pending' NOT NULL,
    input_data JSONB NOT NULL,
    result JSONB,
    error_message TEXT,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms BIGINT,
    
    -- Indexes for performance
    INDEX idx_fraud_jobs_user_id (user_id),
    INDEX idx_fraud_jobs_status (status),
    INDEX idx_fraud_jobs_created_at (created_at DESC)
);

-- Add trigger for job timing
CREATE OR REPLACE FUNCTION update_job_timing()
RETURNS TRIGGER AS $$
BEGIN
    -- Set started_at when status changes to processing
    IF OLD.status != 'processing' AND NEW.status = 'processing' THEN
        NEW.started_at = timezone('utc'::text, now());
    END IF;
    
    -- Set completed_at and calculate processing time when job finishes
    IF OLD.status IN ('pending', 'processing') AND NEW.status IN ('completed', 'failed', 'cancelled') THEN
        NEW.completed_at = timezone('utc'::text, now());
        IF NEW.started_at IS NOT NULL THEN
            NEW.processing_time_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fraud_jobs_timing 
    BEFORE UPDATE ON public.fraud_detection_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_job_timing();

-- ===============================================
-- 🔍 AUDIT LOGGING
-- ===============================================

-- Create audit logs table for compliance
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Indexes for efficient querying
    INDEX idx_audit_logs_user_id (user_id),
    INDEX idx_audit_logs_action (action),
    INDEX idx_audit_logs_resource_type (resource_type),
    INDEX idx_audit_logs_created_at (created_at DESC),
    INDEX idx_audit_logs_composite (user_id, created_at DESC, action)
);

-- ===============================================
-- 🔐 ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_detection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage all users" ON public.users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Fraud detection jobs policies
CREATE POLICY "Users can view their own jobs" ON public.fraud_detection_jobs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins and auditors can view all jobs" ON public.fraud_detection_jobs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('admin', 'auditor')
        )
    );

CREATE POLICY "Users can create their own jobs" ON public.fraud_detection_jobs
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own jobs" ON public.fraud_detection_jobs
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all jobs" ON public.fraud_detection_jobs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Audit logs policies
CREATE POLICY "Admins and auditors can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('admin', 'auditor')
        )
    );

CREATE POLICY "All authenticated users can create audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ===============================================
-- 🎯 SEED DATA
-- ===============================================

-- Create demo users (requires manual password setup in Supabase Auth)
-- These will need to be created through Supabase Auth UI or API
-- The following is for reference only:

/*
-- Demo Admin User
-- Email: admin@frauddetection.com
-- Password: admin123
-- Role: admin

-- Demo Analyst User  
-- Email: analyst@frauddetection.com
-- Password: analyst123
-- Role: analyst

-- Demo Auditor User
-- Email: auditor@frauddetection.com
-- Password: auditor123
-- Role: auditor
*/

-- Insert user profiles (after creating auth users)
-- These would be inserted after the auth users are created
INSERT INTO public.users (id, email, full_name, role, department) VALUES
    -- Replace with actual UUIDs from auth.users after creation
    ('00000000-0000-0000-0000-000000000001'::UUID, 'admin@frauddetection.com', 'System Administrator', 'admin', 'IT Security'),
    ('00000000-0000-0000-0000-000000000002'::UUID, 'analyst@frauddetection.com', 'Security Analyst', 'analyst', 'Fraud Detection'),
    ('00000000-0000-0000-0000-000000000003'::UUID, 'auditor@frauddetection.com', 'Compliance Auditor', 'auditor', 'Risk Management')
ON CONFLICT (id) DO NOTHING;

-- ===============================================
-- 📈 ANALYTICS VIEWS
-- ===============================================

-- Create view for user activity statistics
CREATE OR REPLACE VIEW user_activity_stats AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    COUNT(j.id) as total_jobs,
    COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN j.status = 'failed' THEN 1 END) as failed_jobs,
    AVG(j.processing_time_ms) as avg_processing_time_ms,
    MAX(j.created_at) as last_job_at,
    COUNT(al.id) as total_actions
FROM public.users u
LEFT JOIN public.fraud_detection_jobs j ON u.id = j.user_id
LEFT JOIN public.audit_logs al ON u.id = al.user_id
GROUP BY u.id, u.email, u.full_name, u.role;

-- Create view for system metrics
CREATE OR REPLACE VIEW system_metrics AS
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(CASE WHEN u.role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN u.role = 'analyst' THEN 1 END) as analyst_count,
    COUNT(CASE WHEN u.role = 'auditor' THEN 1 END) as auditor_count,
    COUNT(j.id) as total_jobs,
    COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN j.status = 'processing' THEN 1 END) as processing_jobs,
    COUNT(CASE WHEN j.status = 'failed' THEN 1 END) as failed_jobs,
    AVG(j.processing_time_ms) as avg_processing_time_ms,
    COUNT(al.id) as total_audit_entries
FROM public.users u
CROSS JOIN public.fraud_detection_jobs j
CROSS JOIN public.audit_logs al;

-- ===============================================
-- 🔧 HELPER FUNCTIONS
-- ===============================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_result user_role;
BEGIN
    SELECT role INTO user_role_result
    FROM public.users
    WHERE id = user_uuid;
    
    RETURN user_role_result;
END;
$$;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(user_uuid UUID, required_role user_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_current user_role;
BEGIN
    SELECT role INTO user_role_current
    FROM public.users
    WHERE id = user_uuid;
    
    -- Admin has all permissions
    IF user_role_current = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Check specific role match
    RETURN user_role_current = required_role;
END;
$$;

-- ===============================================
-- 📝 COMMENTS AND DOCUMENTATION
-- ===============================================

COMMENT ON TABLE public.users IS 'Extended user profiles linked to Supabase auth';
COMMENT ON TABLE public.fraud_detection_jobs IS 'Fraud detection analysis jobs with progress tracking';
COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for compliance';

COMMENT ON COLUMN public.users.role IS 'User role: admin (full access), analyst (detection only), auditor (read-only)';
COMMENT ON COLUMN public.fraud_detection_jobs.progress_percentage IS 'Job completion percentage (0-100)';
COMMENT ON COLUMN public.audit_logs.details IS 'Additional context and metadata for the audited action';

-- ===============================================
-- ✅ SCHEMA SETUP COMPLETE
-- ===============================================

-- This schema provides:
-- 1. ✅ Role-based user management with proper constraints
-- 2. ✅ Comprehensive job tracking with real-time updates
-- 3. ✅ Full audit logging for compliance requirements
-- 4. ✅ Row Level Security for data protection
-- 5. ✅ Performance indexes for efficient queries
-- 6. ✅ Analytics views for reporting and monitoring
-- 7. ✅ Helper functions for permission checking
-- 8. ✅ Automated triggers for data consistency