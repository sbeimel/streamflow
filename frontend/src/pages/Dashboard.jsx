import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useToast } from '@/hooks/use-toast.js'
import { automationAPI, streamAPI, streamCheckerAPI } from '@/services/api'
import { PlayCircle, RefreshCw, Search, Activity } from 'lucide-react'

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [streamCheckerStatus, setStreamCheckerStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const [automationResponse, streamCheckerResponse] = await Promise.all([
        automationAPI.getStatus(),
        streamCheckerAPI.getStatus()
      ])
      setStatus(automationResponse.data)
      setStreamCheckerStatus(streamCheckerResponse.data)
    } catch (err) {
      console.error('Failed to load status:', err)
      toast({
        title: "Error",
        description: "Failed to load automation status",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshPlaylist = async () => {
    try {
      setActionLoading('playlist')
      await streamAPI.refreshPlaylist()
      toast({
        title: "Success",
        description: "Playlist refresh initiated successfully"
      })
      await loadStatus()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to refresh playlist",
        variant: "destructive"
      })
    } finally {
      setActionLoading('')
    }
  }

  const handleDiscoverStreams = async () => {
    try {
      setActionLoading('discover')
      const response = await streamAPI.discoverStreams()
      toast({
        title: "Success",
        description: `Stream discovery completed. ${response.data.total_assigned} streams assigned.`
      })
      await loadStatus()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to discover streams",
        variant: "destructive"
      })
    } finally {
      setActionLoading('')
    }
  }

  const handleTriggerGlobalAction = async () => {
    try {
      setActionLoading('global')
      await streamCheckerAPI.triggerGlobalAction()
      toast({
        title: "Success",
        description: "Global action triggered successfully"
      })
      await loadStatus()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to trigger global action",
        variant: "destructive"
      })
    } finally {
      setActionLoading('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const isAutomationRunning = status?.is_running || false
  const isStreamCheckerRunning = streamCheckerStatus?.is_running || false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and control your stream automation
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Automation Status
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isAutomationRunning ? (
                <span className="text-green-500">Running</span>
              ) : (
                <span className="text-gray-500">Stopped</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Background automation service
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Stream Checker
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStreamCheckerRunning ? (
                <span className="text-green-500">Active</span>
              ) : (
                <span className="text-gray-500">Idle</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Quality checking service
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Last Update
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.last_update ? (
                new Date(status.last_update).toLocaleTimeString()
              ) : (
                'N/A'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Most recent activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pipeline Mode
            </CardTitle>
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {streamCheckerStatus?.config?.pipeline_mode || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current automation level
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Perform common operations on your stream management system
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button
            onClick={handleRefreshPlaylist}
            disabled={actionLoading === 'playlist'}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {actionLoading === 'playlist' ? 'Refreshing...' : 'Refresh Playlist'}
          </Button>

          <Button
            onClick={handleDiscoverStreams}
            disabled={actionLoading === 'discover'}
            variant="outline"
          >
            <Search className="mr-2 h-4 w-4" />
            {actionLoading === 'discover' ? 'Discovering...' : 'Discover Streams'}
          </Button>

          <Button
            onClick={handleTriggerGlobalAction}
            disabled={actionLoading === 'global'}
            variant="outline"
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            {actionLoading === 'global' ? 'Triggering...' : 'Trigger Global Action'}
          </Button>
        </CardContent>
      </Card>

      {/* System Information */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Automation Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Enabled Features:</dt>
                <dd className="font-medium">
                  {status?.config?.enabled_features?.length || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Update Interval:</dt>
                <dd className="font-medium">
                  {status?.config?.playlist_update_interval || 'N/A'}s
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">M3U Accounts:</dt>
                <dd className="font-medium">
                  {status?.config?.enabled_m3u_accounts?.length || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stream Checker Status</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Queue Size:</dt>
                <dd className="font-medium">
                  {streamCheckerStatus?.queue_size || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Active Workers:</dt>
                <dd className="font-medium">
                  {streamCheckerStatus?.active_workers || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Processed:</dt>
                <dd className="font-medium">
                  {streamCheckerStatus?.total_processed || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
