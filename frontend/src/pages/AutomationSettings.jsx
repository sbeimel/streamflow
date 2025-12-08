import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'

export default function AutomationSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automation Settings</h1>
        <p className="text-muted-foreground">
          Configure pipeline mode, scheduling, and automation parameters
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation Settings</CardTitle>
          <CardDescription>
            Select your pipeline mode and adjust update intervals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Automation settings functionality coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
