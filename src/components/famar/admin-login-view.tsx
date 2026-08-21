'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export function AdminLoginView() {
  const navigate = useAppStore((s) => s.navigate)
  const { login, isAuthenticated } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('admin-dashboard')
    }
  }, [isAuthenticated, navigate])

  if (isAuthenticated) {
    return null
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Por favor completa todos los campos')
      return
    }
    setLoading(true)
    try {
      const success = await login(username, password)
      if (success) {
        toast.success('Bienvenido, Admin')
        navigate('admin-dashboard')
      } else {
        toast.error('Credenciales incorrectas')
      }
    } catch {
      toast.error('Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Panel de Administración</CardTitle>
            <CardDescription>Inicia sesión para gestionar FAMAR</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="luisa"
                  autoComplete="username"
                />
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
            <Button
              variant="ghost"
              className="w-full mt-3"
              onClick={() => navigate('home')}
            >
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}