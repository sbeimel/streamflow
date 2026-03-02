# Priority Queue - Praktischer Leitfaden

## Was ist eine Priority Queue?

Eine **Priority Queue** sortiert Channels nach Wichtigkeit, sodass wichtige Channels **zuerst** verarbeitet werden.

---

## Beispiel-Szenario

### Ohne Priority Queue (aktuell)
```
Automation startet um 18:00 Uhr:

18:00 - Channel 1: ARD-alpha (unwichtig)      ← Wird zuerst geprüft
18:05 - Channel 2: Sat.1 Gold (unwichtig)
18:10 - Channel 3: Sky Sport (WICHTIG!)       ← Muss 10 Min warten!
18:15 - Channel 4: Sky Bundesliga (WICHTIG!)
...

Problem: Wichtige Sport-Channels müssen warten!
```

### Mit Priority Queue
```
Automation startet um 18:00 Uhr:

18:00 - Channel 3: Sky Sport (Priorität 0)         ← Sofort!
18:05 - Channel 4: Sky Bundesliga (Priorität 1)
18:10 - Channel 2: Sat.1 Gold (Priorität 50)
18:15 - Channel 1: ARD-alpha (Priorität 100)
...

Vorteil: Wichtige Channels sind nach 5 Min fertig!
```

---

## Wie funktioniert es?

### 1. Prioritäten definieren

```python
# Priorität: 0 = höchste, 100 = niedrigste

CHANNEL_PRIORITIES = {
    # Sport (höchste Priorität)
    3848: 0,   # Sky Sport
    3982: 1,   # Sky Bundesliga 3 HD
    3926: 2,   # Sky Sport News
    
    # Nachrichten (hohe Priorität)
    4047: 10,  # ARD-alpha HD
    3820: 11,  # kabel eins classics HD
    
    # Entertainment (mittlere Priorität)
    3827: 50,  # Sat.1 Gold HD
    3848: 51,  # one HD
    
    # Sonstige (niedrige Priorität)
    4033: 100, # Sport 11 - myTeamTV
}

# Default für unbekannte Channels
DEFAULT_PRIORITY = 75
```

---

## 2. Implementierung

### Backend: `backend/priority_queue_manager.py`

```python
#!/usr/bin/env python3
"""
Priority Queue Manager

Verwaltet Channel-Prioritäten für Stream Checking.
"""

import heapq
import json
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any, Optional, Dict
from threading import Lock

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).parent.parent / 'data'
PRIORITY_CONFIG_FILE = CONFIG_DIR / 'channel_priorities.json'


@dataclass(order=True)
class PrioritizedChannel:
    """Channel mit Priorität für Heap Queue"""
    priority: int
    channel_id: int = field(compare=False)
    data: Any = field(compare=False)


class PriorityQueueManager:
    """
    Verwaltet Priority Queue für Channels.
    
    Prioritäten:
    - 0-9: Höchste (Sport, Live-Events)
    - 10-49: Hoch (Nachrichten, wichtige Channels)
    - 50-74: Mittel (Entertainment)
    - 75-99: Niedrig (Sonstige)
    - 100+: Niedrigste (Test-Channels)
    """
    
    def __init__(self):
        self._lock = Lock()
        self.queue = []
        self.priorities = {}  # channel_id -> priority
        self.default_priority = 75
        self._load_priorities()
    
    def _load_priorities(self):
        """Lädt Prioritäten aus Config-Datei"""
        try:
            if PRIORITY_CONFIG_FILE.exists():
                with open(PRIORITY_CONFIG_FILE, 'r') as f:
                    data = json.load(f)
                    self.priorities = {int(k): v for k, v in data.get('priorities', {}).items()}
                    self.default_priority = data.get('default_priority', 75)
                    logger.info(f"Loaded {len(self.priorities)} channel priorities")
            else:
                logger.info("No priority config found, using defaults")
                self._create_default_config()
        except Exception as e:
            logger.error(f"Error loading priorities: {e}")
    
    def _save_priorities(self):
        """Speichert Prioritäten in Config-Datei"""
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            data = {
                'priorities': {str(k): v for k, v in self.priorities.items()},
                'default_priority': self.default_priority
            }
            with open(PRIORITY_CONFIG_FILE, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info("Saved channel priorities")
        except Exception as e:
            logger.error(f"Error saving priorities: {e}")
    
    def _create_default_config(self):
        """Erstellt Default-Config mit Beispiel-Prioritäten"""
        self.priorities = {
            # Beispiel: Sport-Channels (höchste Priorität)
            # 3848: 0,  # Sky Sport
            # 3982: 1,  # Sky Bundesliga
        }
        self._save_priorities()
    
    def set_priority(self, channel_id: int, priority: int):
        """
        Setzt Priorität für einen Channel.
        
        Args:
            channel_id: Channel ID
            priority: Priorität (0 = höchste, 100+ = niedrigste)
        """
        with self._lock:
            self.priorities[channel_id] = priority
            self._save_priorities()
            logger.info(f"Set priority {priority} for channel {channel_id}")
    
    def get_priority(self, channel_id: int) -> int:
        """
        Holt Priorität für einen Channel.
        
        Args:
            channel_id: Channel ID
            
        Returns:
            Priorität (0-100+)
        """
        return self.priorities.get(channel_id, self.default_priority)
    
    def set_default_priority(self, priority: int):
        """Setzt Default-Priorität für unbekannte Channels"""
        with self._lock:
            self.default_priority = priority
            self._save_priorities()
    
    def add_channel(self, channel_id: int, data: Any):
        """
        Fügt Channel zur Queue hinzu.
        
        Args:
            channel_id: Channel ID
            data: Channel-Daten (z.B. Channel-Dict)
        """
        with self._lock:
            priority = self.get_priority(channel_id)
            item = PrioritizedChannel(priority, channel_id, data)
            heapq.heappush(self.queue, item)
    
    def get_next(self) -> tuple[Optional[int], Optional[Any]]:
        """
        Holt nächsten Channel aus Queue (höchste Priorität).
        
        Returns:
            Tuple (channel_id, data) oder (None, None) wenn leer
        """
        with self._lock:
            if self.queue:
                item = heapq.heappop(self.queue)
                return item.channel_id, item.data
            return None, None
    
    def is_empty(self) -> bool:
        """Prüft ob Queue leer ist"""
        with self._lock:
            return len(self.queue) == 0
    
    def size(self) -> int:
        """Gibt Anzahl Channels in Queue zurück"""
        with self._lock:
            return len(self.queue)
    
    def clear(self):
        """Leert Queue"""
        with self._lock:
            self.queue = []
    
    def get_all_priorities(self) -> Dict[int, int]:
        """Gibt alle Prioritäten zurück"""
        with self._lock:
            return self.priorities.copy()
    
    def bulk_set_priorities(self, priorities: Dict[int, int]):
        """
        Setzt mehrere Prioritäten auf einmal.
        
        Args:
            priorities: Dict {channel_id: priority}
        """
        with self._lock:
            self.priorities.update(priorities)
            self._save_priorities()
            logger.info(f"Bulk updated {len(priorities)} priorities")


# Singleton
_priority_queue_manager = None

def get_priority_queue_manager() -> PriorityQueueManager:
    """Holt Singleton-Instanz"""
    global _priority_queue_manager
    if _priority_queue_manager is None:
        _priority_queue_manager = PriorityQueueManager()
    return _priority_queue_manager
```

---

## 3. Integration in Stream Checker

### Änderung in `backend/stream_checker_service.py`

```python
from priority_queue_manager import get_priority_queue_manager

class StreamCheckerService:
    def __init__(self):
        # ... existing code ...
        self.priority_queue = get_priority_queue_manager()
    
    def check_streams_for_channels(self, channel_ids: List[int]):
        """Prüft Streams für Channels mit Priorität"""
        
        # 1. Channels in Priority Queue einfügen
        self.priority_queue.clear()
        
        for channel_id in channel_ids:
            channel = self.udi.get_channel_by_id(channel_id)
            if channel:
                self.priority_queue.add_channel(channel_id, channel)
        
        logger.info(f"Added {self.priority_queue.size()} channels to priority queue")
        
        # 2. Channels nach Priorität verarbeiten
        results = []
        
        while not self.priority_queue.is_empty():
            channel_id, channel = self.priority_queue.get_next()
            
            priority = self.priority_queue.get_priority(channel_id)
            logger.info(f"Processing channel {channel_id} ({channel['name']}) with priority {priority}")
            
            # Prüfe Streams für diesen Channel
            result = self._check_channel_streams(channel_id, channel)
            results.append(result)
        
        return results
```

---

## 4. Frontend UI

### Neue Seite: `frontend/src/pages/ChannelPriorities.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function ChannelPriorities() {
  const [channels, setChannels] = useState([]);
  const [priorities, setPriorities] = useState({});
  const [defaultPriority, setDefaultPriority] = useState(75);

  useEffect(() => {
    loadChannels();
    loadPriorities();
  }, []);

  const loadChannels = async () => {
    const response = await fetch('/api/channels');
    const data = await response.json();
    setChannels(data.channels || []);
  };

  const loadPriorities = async () => {
    const response = await fetch('/api/priorities');
    const data = await response.json();
    setPriorities(data.priorities || {});
    setDefaultPriority(data.default_priority || 75);
  };

  const savePriority = async (channelId, priority) => {
    await fetch('/api/priorities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, priority: parseInt(priority) })
    });
    loadPriorities();
  };

  const getPriorityBadge = (priority) => {
    if (priority <= 9) return <Badge className="bg-red-500">Höchste</Badge>;
    if (priority <= 49) return <Badge className="bg-orange-500">Hoch</Badge>;
    if (priority <= 74) return <Badge className="bg-yellow-500">Mittel</Badge>;
    return <Badge className="bg-gray-500">Niedrig</Badge>;
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Channel Prioritäten</CardTitle>
          <p className="text-sm text-gray-500">
            Lege fest, in welcher Reihenfolge Channels geprüft werden sollen.
            Niedrigere Zahlen = höhere Priorität.
          </p>
        </CardHeader>
        <CardContent>
          {/* Default Priority */}
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <label className="block text-sm font-medium mb-2">
              Standard-Priorität (für neue Channels)
            </label>
            <Input
              type="number"
              value={defaultPriority}
              onChange={(e) => setDefaultPriority(e.target.value)}
              className="w-32"
            />
          </div>

          {/* Channel List */}
          <div className="space-y-2">
            {channels.map(channel => {
              const priority = priorities[channel.id] || defaultPriority;
              
              return (
                <div key={channel.id} className="flex items-center gap-4 p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">{channel.name}</div>
                    <div className="text-sm text-gray-500">ID: {channel.id}</div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(priority)}
                    
                    <Input
                      type="number"
                      value={priority}
                      onChange={(e) => savePriority(channel.id, e.target.value)}
                      className="w-24"
                      min="0"
                      max="999"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Priority Legend */}
          <div className="mt-6 p-4 bg-blue-50 rounded">
            <h3 className="font-medium mb-2">Prioritäts-Stufen:</h3>
            <ul className="text-sm space-y-1">
              <li><Badge className="bg-red-500 mr-2">0-9</Badge> Höchste (Sport, Live-Events)</li>
              <li><Badge className="bg-orange-500 mr-2">10-49</Badge> Hoch (Nachrichten)</li>
              <li><Badge className="bg-yellow-500 mr-2">50-74</Badge> Mittel (Entertainment)</li>
              <li><Badge className="bg-gray-500 mr-2">75+</Badge> Niedrig (Sonstige)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 5. API Endpoints

### Ergänzung in `backend/web_api.py`

```python
from priority_queue_manager import get_priority_queue_manager

# GET /api/priorities - Holt alle Prioritäten
@app.route('/api/priorities', methods=['GET'])
def get_priorities():
    """Holt Channel-Prioritäten"""
    try:
        pq = get_priority_queue_manager()
        return jsonify({
            'priorities': pq.get_all_priorities(),
            'default_priority': pq.default_priority
        })
    except Exception as e:
        logger.error(f"Error getting priorities: {e}")
        return jsonify({'error': str(e)}), 500

# POST /api/priorities - Setzt Priorität
@app.route('/api/priorities', methods=['POST'])
def set_priority():
    """Setzt Priorität für einen Channel"""
    try:
        data = request.json
        channel_id = data.get('channel_id')
        priority = data.get('priority')
        
        if not channel_id or priority is None:
            return jsonify({'error': 'channel_id and priority required'}), 400
        
        pq = get_priority_queue_manager()
        pq.set_priority(int(channel_id), int(priority))
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error setting priority: {e}")
        return jsonify({'error': str(e)}), 500

# POST /api/priorities/bulk - Setzt mehrere Prioritäten
@app.route('/api/priorities/bulk', methods=['POST'])
def set_priorities_bulk():
    """Setzt mehrere Prioritäten auf einmal"""
    try:
        data = request.json
        priorities = data.get('priorities', {})
        
        # Convert keys to int
        priorities = {int(k): int(v) for k, v in priorities.items()}
        
        pq = get_priority_queue_manager()
        pq.bulk_set_priorities(priorities)
        
        return jsonify({'success': True, 'updated': len(priorities)})
    except Exception as e:
        logger.error(f"Error setting bulk priorities: {e}")
        return jsonify({'error': str(e)}), 500
```

---

## 6. Praktische Anwendung

### Szenario 1: Fußball-Abend

```python
# Vor dem Spiel (17:00 Uhr):
pq = get_priority_queue_manager()

# Sport-Channels höchste Priorität
pq.set_priority(3848, 0)  # Sky Sport
pq.set_priority(3982, 1)  # Sky Bundesliga
pq.set_priority(3926, 2)  # Sky Sport News

# Automation läuft um 18:00 Uhr
# → Sport-Channels werden zuerst geprüft!
```

### Szenario 2: Bulk-Update per Gruppe

```python
# Alle Sport-Channels auf Priorität 5
sport_channels = [3848, 3982, 3926, 4033]
priorities = {ch: 5 for ch in sport_channels}
pq.bulk_set_priorities(priorities)

# Alle Entertainment-Channels auf Priorität 50
entertainment_channels = [3827, 3848, 3820]
priorities = {ch: 50 for ch in entertainment_channels}
pq.bulk_set_priorities(priorities)
```

### Szenario 3: Dynamische Anpassung

```python
# Während Live-Event: Priorität erhöhen
if is_live_event_running():
    pq.set_priority(3848, 0)  # Sky Sport → Höchste Priorität
else:
    pq.set_priority(3848, 50)  # Sky Sport → Normale Priorität
```

---

## 7. Vorteile in der Praxis

### Ohne Priority Queue
```
18:00 - Automation startet
18:00 - ARD-alpha wird geprüft (unwichtig)
18:05 - Sat.1 Gold wird geprüft (unwichtig)
18:10 - Sky Sport wird geprüft (WICHTIG!)
18:15 - User beschwert sich: "Warum dauert das so lange?"
```

### Mit Priority Queue
```
18:00 - Automation startet
18:00 - Sky Sport wird geprüft (Priorität 0)
18:05 - Sky Bundesliga wird geprüft (Priorität 1)
18:10 - Sat.1 Gold wird geprüft (Priorität 50)
18:15 - User ist zufrieden: "Sport-Channels sind schon fertig!"
```

---

## 8. Konfiguration

### Config-Datei: `data/channel_priorities.json`

```json
{
  "priorities": {
    "3848": 0,
    "3982": 1,
    "3926": 2,
    "4047": 10,
    "3820": 11,
    "3827": 50,
    "4033": 100
  },
  "default_priority": 75
}
```

---

## 9. Monitoring

### Log-Output

```
2026-03-02 18:00:00 - INFO - Added 298 channels to priority queue
2026-03-02 18:00:01 - INFO - Processing channel 3848 (Sky Sport) with priority 0
2026-03-02 18:05:23 - INFO - Processing channel 3982 (Sky Bundesliga) with priority 1
2026-03-02 18:10:45 - INFO - Processing channel 3926 (Sky Sport News) with priority 2
2026-03-02 18:15:12 - INFO - Processing channel 4047 (ARD-alpha) with priority 10
...
```

---

## 10. FAQ

### Q: Muss ich für jeden Channel eine Priorität setzen?
**A:** Nein! Channels ohne Priorität bekommen automatisch die Default-Priorität (75).

### Q: Was passiert bei gleicher Priorität?
**A:** Channels mit gleicher Priorität werden in zufälliger Reihenfolge verarbeitet.

### Q: Kann ich Prioritäten während der Automation ändern?
**A:** Ja, aber nur für zukünftige Runs. Laufende Automation wird nicht beeinflusst.

### Q: Wie finde ich heraus, welche Channels wichtig sind?
**A:** Schau in deine Logs oder frage deine User, welche Channels sie am meisten nutzen.

### Q: Kostet Priority Queue Performance?
**A:** Nein! Die Queue ist sehr effizient (O(log n) für Insert/Pop).

---

## Zusammenfassung

**Priority Queue ist perfekt für:**
- Live-Events (Sport, Nachrichten)
- Wichtige Channels zuerst prüfen
- Bessere User-Erfahrung
- Keine Zeitersparnis, aber bessere Reihenfolge

**Handhabung:**
1. Prioritäten in UI oder Config setzen
2. Automation läuft automatisch mit Prioritäten
3. Wichtige Channels werden zuerst geprüft
4. User sind zufriedener!

---

**Erstellt:** 2026-03-02
**Autor:** Kiro AI Assistant
