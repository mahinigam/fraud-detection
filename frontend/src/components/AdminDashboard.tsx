import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  Shield, 
  Activity, 
  Settings,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Eye,
  Crown,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { supabase, User } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { auditLogger } from '../utils/auditLogger'
import { notifications } from '../utils/notifications'

interface AdminDashboardProps {
  onClose?: () => void
}

export default function AdminDashboard({ onClose }: AdminDashboardProps) {
  const { userProfile, hasRole } = useAuth()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')

  // Check admin permission
  useEffect(() => {
    if (!hasRole('admin')) {
      notifications.permissionDenied('access admin dashboard')
      onClose?.()
    }
  }, [hasRole, onClose])

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading users:', error)
        notifications.error('Failed to load users')
        return
      }

      setUsers(data || [])
      
      await auditLogger.log('admin_users_viewed', 'user', 'all_users', {
        user_count: data?.length || 0
      })
      
    } catch (error) {
      console.error('Failed to load users:', error)
      notifications.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: 'admin' | 'analyst' | 'auditor') => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) {
        console.error('Error updating user role:', error)
        notifications.error('Failed to update user role')
        return
      }

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))

      notifications.success(`User role updated to ${newRole}`)
      
      await auditLogger.log('user_role_updated', 'user', userId, {
        new_role: newRole,
        updated_by: userProfile?.id
      })

    } catch (error) {
      console.error('Failed to update user role:', error)
      notifications.error('Failed to update user role')
    }
  }

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !isActive })
        .eq('id', userId)

      if (error) {
        console.error('Error updating user status:', error)
        notifications.error('Failed to update user status')
        return
      }

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_active: !isActive } : user
      ))

      notifications.success(`User ${!isActive ? 'activated' : 'deactivated'}`)
      
      await auditLogger.log('user_status_updated', 'user', userId, {
        new_status: !isActive ? 'active' : 'inactive',
        updated_by: userProfile?.id
      })

    } catch (error) {
      console.error('Failed to update user status:', error)
      notifications.error('Failed to update user status')
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'all' || user.role === selectedRole
    
    return matchesSearch && matchesRole
  })

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Crown
      case 'analyst': return Search  
      case 'auditor': return Eye
      default: return Users
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-yellow-400'
      case 'analyst': return 'text-blue-400'
      case 'auditor': return 'text-green-400'
      default: return 'text-gray-400'
    }
  }

  if (!hasRole('admin')) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        className="w-full max-w-6xl max-h-[90vh] glass-panel p-6 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
              <p className="text-white/60">System administration and user management</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white/80 transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-white/5 p-1 rounded-lg">
          {[
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'audit', label: 'Audit Logs', icon: Activity },
            { id: 'system', label: 'System Health', icon: Settings }
          ].map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-md transition-all
                ${activeTab === tab.id 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                }
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </motion.button>
          ))}
        </div>

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Filters and Search */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4 flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="glass-input pl-10 w-64"
                  />
                </div>
                
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="glass-input"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="analyst">Analyst</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass-button flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </motion.button>
            </div>

            {/* Users Table */}
            <div className="glass-panel p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left p-4 text-white/80 font-medium">User</th>
                      <th className="text-left p-4 text-white/80 font-medium">Role</th>
                      <th className="text-left p-4 text-white/80 font-medium">Department</th>
                      <th className="text-left p-4 text-white/80 font-medium">Status</th>
                      <th className="text-left p-4 text-white/80 font-medium">Last Login</th>
                      <th className="text-left p-4 text-white/80 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user, index) => {
                          const RoleIcon = getRoleIcon(user.role)
                          const roleColor = getRoleColor(user.role)
                          
                          return (
                            <motion.tr
                              key={user.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ delay: index * 0.05 }}
                              className="border-b border-white/5 hover:bg-white/5"
                            >
                              <td className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">
                                      {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="text-white font-medium">
                                      {user.full_name || 'Unnamed User'}
                                    </div>
                                    <div className="text-white/60 text-sm">{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              
                              <td className="p-4">
                                <div className="flex items-center space-x-2">
                                  <RoleIcon className={`w-4 h-4 ${roleColor}`} />
                                  <span className={`capitalize font-medium ${roleColor}`}>
                                    {user.role}
                                  </span>
                                </div>
                              </td>
                              
                              <td className="p-4 text-white/80">
                                {user.department || 'Not specified'}
                              </td>
                              
                              <td className="p-4">
                                <div className="flex items-center space-x-2">
                                  {user.is_active ? (
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  )}
                                  <span className={user.is_active ? 'text-green-400' : 'text-red-400'}>
                                    {user.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </td>
                              
                              <td className="p-4 text-white/60 text-sm">
                                {user.last_login 
                                  ? new Date(user.last_login).toLocaleDateString()
                                  : 'Never'
                                }
                              </td>
                              
                              <td className="p-4">
                                <div className="flex items-center space-x-2">
                                  <select
                                    value={user.role}
                                    onChange={(e) => updateUserRole(user.id, e.target.value as any)}
                                    className="text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                                  >
                                    <option value="admin">Admin</option>
                                    <option value="analyst">Analyst</option>
                                    <option value="auditor">Auditor</option>
                                  </select>
                                  
                                  <motion.button
                                    onClick={() => toggleUserStatus(user.id, user.is_active)}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className={`p-1 rounded transition-colors ${
                                      user.is_active 
                                        ? 'text-red-400 hover:bg-red-500/20' 
                                        : 'text-green-400 hover:bg-green-500/20'
                                    }`}
                                  >
                                    {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                  </motion.button>
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>

            {!loading && filteredUsers.length === 0 && (
              <div className="text-center py-12 text-white/60">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No users found matching your criteria</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Placeholder for other tabs */}
        {activeTab === 'audit' && (
          <div className="text-center py-12 text-white/60">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Audit logs viewer coming soon...</p>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="text-center py-12 text-white/60">
            <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>System health monitoring coming soon...</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}