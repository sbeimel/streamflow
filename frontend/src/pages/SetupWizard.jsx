import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'

export default function SetupWizard({ onComplete, setupStatus }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to StreamFlow</CardTitle>
          <CardDescription>
            Let's get your stream management system configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Setup wizard functionality coming soon...
            </p>
            <p className="text-sm text-muted-foreground">
              Setup Status: {setupStatus?.setup_complete ? 'Complete' : 'Incomplete'}
            </p>
            <Button onClick={onComplete}>
              Continue to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
