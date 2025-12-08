import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'

export default function ChannelConfiguration() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Channel Configuration</h1>
        <p className="text-muted-foreground">
          Configure channel regex patterns and stream assignments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel Configuration</CardTitle>
          <CardDescription>
            Set up regex patterns for automatic stream-to-channel assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Channel configuration functionality coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
