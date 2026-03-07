import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Info, TrendingUp, Zap, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast.js';

const ScoringMethodSettings = () => {
  const [scoringMethod, setScoringMethod] = useState('enhanced');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchScoringMethod();
  }, []);

  const fetchScoringMethod = async () => {
    try {
      const response = await fetch('/api/stream-checker/config');
      const data = await response.json();
      setScoringMethod(data.scoring?.method || 'enhanced');
    } catch (error) {
      console.error('Failed to fetch scoring method:', error);
      toast({
        title: "Fehler",
        description: "Scoring-Methode konnte nicht geladen werden",
        variant: "destructive"
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleMethodChange = async (method) => {
    if (method === scoringMethod) return;
    
    setLoading(true);

    try {
      const response = await fetch('/api/stream-checker/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoring: {
            method: method
          }
        })
      });

      if (response.ok) {
        setScoringMethod(method);
        toast({
          title: "Erfolg",
          description: `Scoring-Methode auf "${method === 'enhanced' ? 'Enhanced' : 'Legacy'}" umgestellt. Führe "Rescore & Resort" aus um bestehende Channels neu zu bewerten.`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update scoring method');
      }
    } catch (error) {
      console.error('Error updating scoring method:', error);
      toast({
        title: "Fehler",
        description: error.message || 'Fehler beim Aktualisieren der Scoring-Methode',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Quality Scoring Methode
        </CardTitle>
        <CardDescription>
          Wähle die Methode zur Stream-Qualitätsbewertung
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">Wähle die Methode zur Stream-Qualitätsbewertung:</p>
            <ul className="space-y-1 ml-4 list-disc text-sm">
              <li><strong>Enhanced</strong>: Wissenschaftlicher Ansatz mit Codec-Awareness (empfohlen)</li>
              <li><strong>Legacy</strong>: Klassische lineare Bewertung (für Kompatibilität)</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Method Selection */}
        <div className="space-y-4">
          {/* Enhanced Method */}
          <div
            className={`flex items-start justify-between space-x-4 rounded-lg border-2 p-4 cursor-pointer transition-all ${
              scoringMethod === 'enhanced'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => !loading && handleMethodChange('enhanced')}
          >
            <div className="flex gap-3 flex-1">
              <div className="flex-shrink-0 mt-1">
                <Zap className={`h-5 w-5 ${scoringMethod === 'enhanced' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-base font-semibold cursor-pointer">Enhanced Scoring</Label>
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs font-medium rounded">
                    Empfohlen
                  </span>
                  {scoringMethod === 'enhanced' && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Aktiv
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  MACstrom-inspirierte Sigmoid-Kurve mit Codec-Awareness
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Codec-Aware:</strong> HEVC @ 4.5 Mbps = H.264 @ 8 Mbps (gleiche Qualität)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Resolution-Hierarchie:</strong> 720p kann niemals 1080p schlagen
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Off-Air-Detection:</strong> Streams &lt; 200 kbps = Score 0 (Placeholder)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Sigmoid-Kurve:</strong> Bessere Diskriminierung im kritischen Bereich
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Beispiel:</strong> 1080p HEVC @ 4.5 Mbps → Score: 0.75 | 720p H.264 @ 8 Mbps → Score: 0.67
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Legacy Method */}
          <div
            className={`flex items-start justify-between space-x-4 rounded-lg border-2 p-4 cursor-pointer transition-all ${
              scoringMethod === 'legacy'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => !loading && handleMethodChange('legacy')}
          >
            <div className="flex gap-3 flex-1">
              <div className="flex-shrink-0 mt-1">
                <TrendingUp className={`h-5 w-5 ${scoringMethod === 'legacy' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-base font-semibold cursor-pointer">Legacy Scoring</Label>
                  {scoringMethod === 'legacy' && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Aktiv
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Klassische lineare Bewertung (Bitrate × 0.40 + Resolution × 0.35 + FPS × 0.15 + Codec × 0.10)
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      Lineare Gewichtung aller Faktoren
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      Keine Codec-Awareness (HEVC wird bestraft)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      720p @ 8 Mbps kann 1080p HEVC @ 4.5 Mbps schlagen
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      Off-Air-Streams (145 kbps) bekommen Score 0.26 statt 0
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Beispiel:</strong> 1080p HEVC @ 4.5 Mbps → Score: 0.73 | 720p H.264 @ 8 Mbps → Score: 0.88
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <h4 className="font-medium mb-2">Wichtige Hinweise:</h4>
            <ul className="space-y-1 text-sm">
              <li>• M3U-Prioritäten und Quality-Preferences bleiben unverändert</li>
              <li>• Nach Umstellung "Rescore & Resort" ausführen um Channels neu zu bewerten</li>
              <li>• Jederzeit zwischen Methoden wechselbar (kein Datenverlust)</li>
              <li>• Enhanced-Methode basiert auf wissenschaftlichen Standards (ITU-T P.1203.3)</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default ScoringMethodSettings;
