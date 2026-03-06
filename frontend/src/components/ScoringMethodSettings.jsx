import React, { useState, useEffect } from 'react';
import { Info, TrendingUp, Zap } from 'lucide-react';

const ScoringMethodSettings = () => {
  const [scoringMethod, setScoringMethod] = useState('enhanced');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

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
    }
  };

  const handleMethodChange = async (method) => {
    setLoading(true);
    setMessage(null);

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
        setMessage({
          type: 'success',
          text: `Scoring-Methode auf "${method === 'enhanced' ? 'Enhanced' : 'Legacy'}" umgestellt. Führe "Rescore & Resort" aus um bestehende Channels neu zu bewerten.`
        });
      } else {
        throw new Error('Failed to update scoring method');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Fehler beim Aktualisieren der Scoring-Methode'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Quality Scoring Methode</h3>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-2">Wähle die Methode zur Stream-Qualitätsbewertung:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li><strong>Enhanced</strong>: Wissenschaftlicher Ansatz mit Codec-Awareness (empfohlen)</li>
              <li><strong>Legacy</strong>: Klassische lineare Bewertung (für Kompatibilität)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Method Selection */}
      <div className="space-y-4">
        {/* Enhanced Method */}
        <div
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            scoringMethod === 'enhanced'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => !loading && handleMethodChange('enhanced')}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Zap className={`w-6 h-6 ${scoringMethod === 'enhanced' ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-gray-900">Enhanced Scoring</h4>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                  Empfohlen
                </span>
                {scoringMethod === 'enhanced' && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                    Aktiv
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                MACstrom-inspirierte Sigmoid-Kurve mit Codec-Awareness
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-gray-700">
                    <strong>Codec-Aware:</strong> HEVC @ 4.5 Mbps = H.264 @ 8 Mbps (gleiche Qualität)
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-gray-700">
                    <strong>Resolution-Hierarchie:</strong> 720p kann niemals 1080p schlagen
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-gray-700">
                    <strong>Off-Air-Detection:</strong> Streams &lt; 200 kbps = Score 0 (Placeholder)
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-gray-700">
                    <strong>Sigmoid-Kurve:</strong> Bessere Diskriminierung im kritischen Bereich
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  <strong>Beispiel:</strong> 1080p HEVC @ 4.5 Mbps → Score: 0.75 | 720p H.264 @ 8 Mbps → Score: 0.67
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Legacy Method */}
        <div
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            scoringMethod === 'legacy'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => !loading && handleMethodChange('legacy')}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <TrendingUp className={`w-6 h-6 ${scoringMethod === 'legacy' ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-gray-900">Legacy Scoring</h4>
                {scoringMethod === 'legacy' && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                    Aktiv
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Klassische lineare Bewertung (Bitrate × 0.40 + Resolution × 0.35 + FPS × 0.15 + Codec × 0.10)
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-700">
                    Lineare Gewichtung aller Faktoren
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-700">
                    Keine Codec-Awareness (HEVC wird bestraft)
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-700">
                    720p @ 8 Mbps kann 1080p HEVC @ 4.5 Mbps schlagen
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-700">
                    Off-Air-Streams (145 kbps) bekommen Score 0.26 statt 0
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  <strong>Beispiel:</strong> 1080p HEVC @ 4.5 Mbps → Score: 0.73 | 720p H.264 @ 8 Mbps → Score: 0.88
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mt-4 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Additional Info */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="font-medium text-gray-900 mb-2">Wichtige Hinweise:</h4>
        <ul className="space-y-1 text-sm text-gray-600">
          <li>• M3U-Prioritäten und Quality-Preferences bleiben unverändert</li>
          <li>• Nach Umstellung "Rescore & Resort" ausführen um Channels neu zu bewerten</li>
          <li>• Jederzeit zwischen Methoden wechselbar (kein Datenverlust)</li>
          <li>• Enhanced-Methode basiert auf wissenschaftlichen Standards (ITU-T P.1203.3)</li>
        </ul>
      </div>
    </div>
  );
};

export default ScoringMethodSettings;
