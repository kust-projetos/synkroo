'use client'

import React from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ContactErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Contact panel error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <p className="text-muted-foreground mb-2">Ocorreu um erro ao carregar os dados</p>
          <p className="text-sm text-muted-foreground mb-4">{this.state.error?.message}</p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            variant="outline"
          >
            Tentar novamente
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}