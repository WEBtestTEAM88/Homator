'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, Thermometer, Fan, Droplet, Lock, Unlock, Plus, Trash2, Edit, Settings, Lightbulb, Power, Wifi, Bell, Camera, Tv, Speaker, Coffee } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import mqtt from 'mqtt';

type DeviceType = 'switch' | 'slider' | 'button' | 'read'
type IconType = 'sun' | 'moon' | 'thermometer' | 'fan' | 'droplet' | 'lock' | 'unlock' | 'lightbulb' | 'power' | 'wifi' | 'bell' | 'camera' | 'tv' | 'speaker' | 'coffee'

type Device = {
  id: string
  name: string
  type: DeviceType
  topic: string
  value: number | boolean | string
  icon: IconType
  config: {
    onMessage?: string
    offMessage?: string
    min?: number
    max?: number
    step?: number
    unit?: string
    buttonMessage?: string
  }
}

type Settings = {
  mqttBroker: string;
  mqttUsername: string;
  mqttPassword: string;
  protocol?: 'ws' | 'wss';
  host?: string;
  port?: string;
  path?: string;
}

type BrokerPreset = {
  name: string;
  url: string;
  port: number;
  wsUrl: string;
  description: string;
}

const brokerPresets: BrokerPreset[] = [
  {
    name: "EMQX",
    url: "broker.emqx.io",
    port: 1883,
    wsUrl: "wss://broker.emqx.io:8084/mqtt",
    description: "Public broker by EMQX"
  },
  {
    name: "HiveMQ",
    url: "broker.hivemq.com",
    port: 1883,
    wsUrl: "wss://broker.hivemq.com:8884/mqtt",
    description: "Public broker by HiveMQ"
  },
  {
    name: "Mosquitto",
    url: "test.mosquitto.org",
    port: 1883,
    wsUrl: "wss://test.mosquitto.org:8081/mqtt",
    description: "Eclipse Mosquitto Test Broker"
  }
];

// Add a type for connection mode
type ConnectionMode = 'preset' | 'custom';

// Add this type for device updates
type DeviceUpdate = Partial<Device> & { id: string };

export function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [settings, setSettings] = useState<Settings>({
    mqttBroker: brokerPresets[0].wsUrl,
    mqttUsername: '',
    mqttPassword: '',
  })
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false)
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null)
  const [client, setClient] = useState<mqtt.MqttClient | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('preset');
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, number>>({});
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedDevices = localStorage.getItem('devices')
    if (savedDevices) {
      setDevices(JSON.parse(savedDevices))
    }
    const savedSettings = localStorage.getItem('settings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
    const savedDarkMode = localStorage.getItem('darkMode')
    if (savedDarkMode) {
      setIsDarkMode(JSON.parse(savedDarkMode))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('devices', JSON.stringify(devices))
  }, [devices])

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    if (client) {
      client.end(); // Close existing connection
    }

    const mqttClient = mqtt.connect(settings.mqttBroker, {
      username: settings.mqttUsername,
      password: settings.mqttPassword,
      clientId: `dashboard_${Math.random().toString(16).slice(2)}`,
    });

    mqttClient.on('connect', () => {
      console.log('Connected to MQTT broker');
      toast({
        title: "Connected",
        description: "Successfully connected to MQTT broker"
      });
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT error:', err);
      toast({
        title: "Connection Error",
        description: "Failed to connect to MQTT broker",
        variant: "destructive"
      });
    });

    mqttClient.on('message', (topic, message) => {
      console.log(`Received message on ${topic}:`, message.toString());
      
      setDevices(prevDevices => 
        prevDevices.map(device => {
          if (device.topic !== topic) return device;
          
          // For switch devices, properly parse the message
          if (device.type === 'switch') {
            const messageStr = message.toString();
            const newValue = messageStr === (device.config.onMessage || "ON");
            // Only update if the value is different
            if (Boolean(device.value) !== newValue) {
              return { ...device, value: newValue };
            }
          }
          
          return device;
        })
      );
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, [settings.mqttBroker, settings.mqttUsername, settings.mqttPassword]);

  useEffect(() => {
    if (!client) return;

    // Subscribe to all topics of existing devices that need subscriptions
    devices.forEach(device => {
      if ((device.type === 'read' || device.type === 'switch') && !subscriptions.has(device.topic)) {
        client.subscribe(device.topic, (err) => {
          if (!err) {
            setSubscriptions(prev => new Set([...prev, device.topic]));
            console.log(`Subscribed to ${device.topic}`);
          }
        });
      }
    });

    // Message handler with strict topic matching
    client.on('message', (topic, message) => {
      console.log(`Received message on ${topic}:`, message.toString());
      
      setDevices(prevDevices => 
        prevDevices.map(device => {
          // Only update if topics match exactly
          if (device.topic !== topic) return device;
          
          switch (device.type) {
            case 'switch':
              // Only update switches with exact message match
              const messageStr = message.toString();
              if (messageStr === device.config.onMessage || messageStr === device.config.offMessage) {
                const isOn = messageStr === device.config.onMessage;
                return { ...device, value: isOn };
              }
              return device;
            
            case 'read':
              // Update read devices with new value
              let value = message.toString();
              // Try to parse numeric values
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                value = numValue;
              }
              return { ...device, value };
            
            default:
              return device;
          }
        })
      );
    });

    return () => {
      // Cleanup subscriptions on unmount
      subscriptions.forEach(topic => {
        client.unsubscribe(topic);
      });
      client.removeAllListeners('message');
    };
  }, [client, devices, subscriptions]);

  const publishMessage = useCallback((topic: string, message: string) => {
    if (!client) {
      toast({
        title: "Error",
        description: "MQTT client not connected",
        variant: "destructive"
      });
      return;
    }

    console.log(`Publishing to ${topic}:`, message);

    client.publish(topic, message, { qos: 1, retain: false }, (error) => {
      if (error) {
        console.error('Publish error:', error);
        toast({
          title: "Publish Error",
          description: `Failed to publish to ${topic}`,
          variant: "destructive"
        });
      } else {
        console.log(`Successfully published to ${topic}`);
        // Only update switch state after successful publish
        if (message === "ON" || message === "OFF") {
          setDevices(prevDevices =>
            prevDevices.map(device => {
              if (device.topic === topic && device.type === 'switch') {
                return { ...device, value: message === "ON" };
              }
              return device;
            })
          );
        }
      }
    });
  }, [client]);

  const subscribeToTopic = useCallback((topic: string) => {
    if (!client) {
      toast({
        title: "Error",
        description: "MQTT client not connected",
        variant: "destructive"
      });
      return;
    }

    client.subscribe(topic, (error) => {
      if (error) {
        console.error('Subscribe error:', error);
        toast({
          title: "Subscribe Error",
          description: "Failed to subscribe to topic",
          variant: "destructive"
        });
      } else {
        console.log(`Subscribed to ${topic}`);
        toast({
          title: "Success",
          description: `Subscribed to ${topic}`
        });
      }
    });
  }, [client]);

  useEffect(() => {
    if (client && client.connected) {
      devices.forEach(device => {
        subscribeToTopic(device.topic);
      });
    }
  }, [client, devices, subscribeToTopic]);

  const handleDeviceChange = (deviceId: string, value: number | boolean | string) => {
    const device = devices.find(d => d.id === deviceId)
    if (!device) return

    let mqttMessage = ''
    switch (device.type) {
      case 'switch':
        mqttMessage = value ? device.config.onMessage || 'ON' : device.config.offMessage || 'OFF'
        break
      case 'slider':
        mqttMessage = value.toString()
        break
      case 'button':
        mqttMessage = device.config.buttonMessage || 'PRESSED'
        break
    }

    publishMessage(device.topic, mqttMessage)

    setDevices(devices.map(d => d.id === deviceId ? { ...d, value } : d))
  }

  const handleAddOrUpdateDevice = (device: Omit<Device, 'id'>) => {
    if (editingDevice) {
      setDevices(devices.map(d => d.id === editingDevice.id ? { ...device, id: editingDevice.id } : d))
      setEditingDevice(null)
      toast({ title: "Device updated", description: `${device.name} has been updated.` })
    } else {
      const id = (Math.max(...devices.map(d => parseInt(d.id)), 0) + 1).toString()
      setDevices([...devices, { ...device, id }])
      toast({ title: "Device added", description: `${device.name} has been added to your dashboard.` })
    }
    subscribeToTopic(device.topic)
    setIsDeviceDialogOpen(false)
  }

  const handleRemoveDevice = (device: Device) => {
    setDeletingDevice(device)
  }

  const confirmRemoveDevice = () => {
    if (deletingDevice) {
      setDevices(devices.filter(device => device.id !== deletingDevice.id))
      toast({ title: "Device removed", description: `${deletingDevice.name} has been removed from your dashboard.` })
      setDeletingDevice(null)
    }
  }

  const handleEditDevice = (editedDevice: Device) => {
    // Unsubscribe from old topic if it's a read or switch device
    if ((editedDevice.type === 'read' || editedDevice.type === 'switch') && client) {
      client.unsubscribe(editedDevice.topic, (err) => {
        if (!err) {
          setSubscriptions(prev => {
            const newSubs = new Set(prev);
            newSubs.delete(editedDevice.topic);
            return newSubs;
          });
        }
      });
    }

    // Update the device in state
    setDevices(prevDevices =>
      prevDevices.map(device =>
        device.id === editedDevice.id ? editedDevice : device
      )
    );

    // Subscribe to new topic if needed
    if ((editedDevice.type === 'read' || editedDevice.type === 'switch') && client) {
      client.subscribe(editedDevice.topic, (err) => {
        if (!err) {
          setSubscriptions(prev => new Set([...prev, editedDevice.topic]));
          console.log(`Subscribed to new topic: ${editedDevice.topic}`);
        }
      });
    }

    // Close the edit dialog
    setEditingDevice(null);

    // Show success toast
    toast({
      title: "Device Updated",
      description: `Successfully updated ${editedDevice.name}`,
    });
  };

  const handleSettingsChange = (newSettings: Partial<Settings>) => {
    setSettings({ ...settings, ...newSettings })
  }

  const renderDeviceIcon = (icon: IconType) => {
    const iconMap = {
      sun: Sun,
      moon: Moon,
      thermometer: Thermometer,
      fan: Fan,
      droplet: Droplet,
      lock: Lock,
      unlock: Unlock,
      lightbulb: Lightbulb,
      power: Power,
      wifi: Wifi,
      bell: Bell,
      camera: Camera,
      tv: Tv,
      speaker: Speaker,
      coffee: Coffee,
    }
    const IconComponent = iconMap[icon]
    return <IconComponent className="h-4 w-4" />
  }

  const renderDevice = useCallback((device: Device) => {
    const commonHeader = (
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{device.name}</CardTitle>
        <div className="flex items-center space-x-2">
          {renderDeviceIcon(device.icon)}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setEditingDevice(device);
              setIsDeviceDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleRemoveDevice(device)}>
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Remove {device.name}</span>
          </Button>
        </div>
      </CardHeader>
    )

    const handleValueChange = (newValue: number | boolean | string) => {
      const message = typeof newValue === 'boolean'
        ? (newValue ? device.config.onMessage || "ON" : device.config.offMessage || "OFF")
        : newValue.toString();
      
      publishMessage(device.topic, message);
    };

    switch (device.type) {
      case 'switch':
        return (
          <Card key={device.id} className="dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
            {commonHeader}
            <CardContent>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={Boolean(device.value)}
                  onCheckedChange={(checked) => {
                    // Prevent rapid toggling
                    const now = Date.now();
                    if (pendingUpdates[device.id] && now - pendingUpdates[device.id] < 1000) {
                      return;
                    }
                    
                    // Update pending state
                    setPendingUpdates(prev => ({
                      ...prev,
                      [device.id]: now
                    }));

                    // Update local state
                    setDevices(prevDevices =>
                      prevDevices.map(d =>
                        d.id === device.id ? { ...d, value: checked } : d
                      )
                    );

                    // Publish message
                    const message = checked ? 
                      (device.config.onMessage || "ON") : 
                      (device.config.offMessage || "OFF");
                    
                    publishMessage(device.topic, message);
                  }}
                />
                <span className="min-w-[2rem]">
                  {Boolean(device.value) ? 'on' : 'off'}
                </span>
              </div>
            </CardContent>
          </Card>
        )
      case 'slider':
        return (
          <Card key={device.id} className="dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
            {commonHeader}
            <CardContent>
              <Slider
                value={[device.value as number]}
                onValueChange={(value) => handleDeviceChange(device.id, value[0])}
                max={device.config.max || 100}
                min={device.config.min || 0}
                step={device.config.step || 1}
              />
              <div className="mt-2">{device.value}{device.config.unit}</div>
            </CardContent>
          </Card>
        )
      case 'button':
        return (
          <Card key={device.id} className="dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
            {commonHeader}
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => {
                  const message = device.config.buttonMessage || "PRESS";
                  console.log(`Button pressed: ${device.name}, Topic: ${device.topic}`);
                  publishMessage(device.topic, message);
                }}
              >
                <div className="flex items-center space-x-2">
                  {renderDeviceIcon(device.icon)}
                  <span>{device.name}</span>
                </div>
              </Button>
            </CardContent>
          </Card>
        )
      case 'read':
        return (
          <Card key={device.id} className="dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
            {commonHeader}
            <CardContent>
              <div className="text-2xl font-bold">{device.value}{device.config.unit}</div>
            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }, [publishMessage]);

  const renderSettingsDialog = () => (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>MQTT Settings</DialogTitle>
      </DialogHeader>
      
      {/* Connection Mode Toggle */}
      <div className="grid gap-4 py-4">
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant={connectionMode === 'preset' ? 'default' : 'outline'}
            onClick={() => setConnectionMode('preset')}
          >
            Use Preset Broker
          </Button>
          <Button
            variant={connectionMode === 'custom' ? 'default' : 'outline'}
            onClick={() => setConnectionMode('custom')}
          >
            Custom Broker
          </Button>
        </div>
      </div>

      {/* Preset Broker Selection */}
      {connectionMode === 'preset' && (
        <div className="grid gap-4 py-4">
          <Label>Select Broker</Label>
          <Select
            value={settings.mqttBroker}
            onValueChange={(value) => setSettings({ ...settings, mqttBroker: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a broker" />
            </SelectTrigger>
            <SelectContent>
              {brokerPresets.map((preset) => (
                <SelectItem key={preset.wsUrl} value={preset.wsUrl}>
                  <div className="flex flex-col">
                    <span className="font-medium">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">{preset.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Custom Broker Configuration */}
      {connectionMode === 'custom' && (
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="protocol" className="text-right">
              Protocol
            </Label>
            <Select
              value={settings.protocol || 'wss'}
              onValueChange={(value) => setSettings({ ...settings, protocol: value })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ws">WS (WebSocket)</SelectItem>
                <SelectItem value="wss">WSS (WebSocket Secure)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="host" className="text-right">
              Host
            </Label>
            <Input
              id="host"
              placeholder="broker.example.com"
              value={settings.host || ''}
              onChange={(e) => setSettings({ ...settings, host: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="port" className="text-right">
              Port
            </Label>
            <Input
              id="port"
              type="number"
              placeholder="8084"
              value={settings.port || ''}
              onChange={(e) => setSettings({ ...settings, port: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="path" className="text-right">
              Path
            </Label>
            <Input
              id="path"
              placeholder="/mqtt"
              value={settings.path || ''}
              onChange={(e) => setSettings({ ...settings, path: e.target.value })}
              className="col-span-3"
            />
          </div>
        </div>
      )}

      {/* Credentials (for both modes) */}
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="username" className="text-right">
            Username
          </Label>
          <Input
            id="username"
            value={settings.mqttUsername}
            onChange={(e) => setSettings({ ...settings, mqttUsername: e.target.value })}
            className="col-span-3"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="password" className="text-right">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={settings.mqttPassword}
            onChange={(e) => setSettings({ ...settings, mqttPassword: e.target.value })}
            className="col-span-3"
          />
        </div>
      </div>

      {/* Connection URL Preview */}
      <div className="mt-4 p-2 bg-muted rounded-md">
        <Label className="text-sm">Connection URL:</Label>
        <div className="mt-1 text-sm font-mono break-all">
          {connectionMode === 'custom' 
            ? `${settings.protocol}://${settings.host}:${settings.port}${settings.path}`
            : settings.mqttBroker}
        </div>
      </div>

      <DialogFooter>
        <Button onClick={() => setIsSettingsOpen(false)}>Save Changes</Button>
      </DialogFooter>
    </DialogContent>
  );

  return (
    <div className={`min-h-screen p-8 ${isDarkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-100'}`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Home Automation Dashboard</h1>
          <div className="space-x-2">
            <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingDevice(null)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Device
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] dark:bg-gray-800 dark:text-gray-100">
                <DialogHeader>
                  <DialogTitle>{editingDevice ? 'Edit Device' : 'Add New Device'}</DialogTitle>
                </DialogHeader>
                <DeviceForm
                  onSubmit={handleAddOrUpdateDevice}
                  initialDevice={editingDevice || undefined}
                />
              </DialogContent>
            </Dialog>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Button>
              </DialogTrigger>
              {renderSettingsDialog()}
            </Dialog>
            <Switch
              checked={isDarkMode}
              onCheckedChange={setIsDarkMode}
              className="ml-4"
            />
            <span>{isDarkMode ? 'Dark' : 'Light'} Mode</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map(renderDevice)}
        </div>
      </div>
      <AlertDialog open={!!deletingDevice} onOpenChange={(isOpen) => !isOpen && setDeletingDevice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Are you sure you want to delete this device?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              This action cannot be undone. This will permanently delete the device
              "{deletingDevice?.name}" and remove it from your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveDevice} className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DeviceForm({ onSubmit, initialDevice }: { onSubmit: (device: Omit<Device, 'id'>) => void, initialDevice?: Device }) {
  const [device, setDevice] = useState<Omit<Device, 'id'>>(
    initialDevice || {
      name: '',
      type: 'switch',
      topic: '',
      value: false,
      icon: 'sun',
      config: {},
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(device)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">
            Name
          </Label>
          <Input
            id="name"
            value={device.name}
            onChange={(e) => setDevice({ ...device, name: e.target.value })}
            className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="type" className="text-right">
            Type
          </Label>
          <Select
            value={device.type}
            onValueChange={(value: DeviceType) => setDevice({ ...device, type: value })}
          >
            <SelectTrigger className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">
              <SelectValue placeholder="Select device type" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
              <SelectItem value="switch">Switch</SelectItem>
              <SelectItem value="slider">Slider</SelectItem>
              <SelectItem value="button">Button</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="topic" className="text-right">
            MQTT Topic
          </Label>
          <Input
            id="topic"
            value={device.topic}
            onChange={(e) => setDevice({ ...device, topic: e.target.value })}
            className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="icon" className="text-right">
            Icon
          </Label>
          <Select
            value={device.icon}
            onValueChange={(value: IconType) => setDevice({ ...device, icon: value })}
          >
            <SelectTrigger className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">
              <SelectValue placeholder="Select icon" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
              <SelectItem value="sun">Sun</SelectItem>
              <SelectItem value="moon">Moon</SelectItem>
              <SelectItem value="thermometer">Thermometer</SelectItem>
              <SelectItem value="fan">Fan</SelectItem>
              <SelectItem value="droplet">Droplet</SelectItem>
              <SelectItem value="lock">Lock</SelectItem>
              <SelectItem value="unlock">Unlock</SelectItem>
              <SelectItem value="lightbulb">Lightbulb</SelectItem>
              <SelectItem value="power">Power</SelectItem>
              <SelectItem value="wifi">Wifi</SelectItem>
              <SelectItem value="bell">Bell</SelectItem>
              <SelectItem value="camera">Camera</SelectItem>
              <SelectItem value="tv">TV</SelectItem>
              <SelectItem value="speaker">Speaker</SelectItem>
              <SelectItem value="coffee">Coffee</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {device.type === 'switch' && (
          <>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="onMessage" className="text-right">
                On Message
              </Label>
              <Input
                id="onMessage"
                value={device.config.onMessage || ''}
                onChange={(e) => setDevice({ ...device, config: { ...device.config, onMessage: e.target.value } })}
                className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="offMessage" className="text-right">
                Off Message
              </Label>
              <Input
                id="offMessage"
                value={device.config.offMessage || ''}
                onChange={(e) => setDevice({ ...device, config: { ...device.config, offMessage: e.target.value } })}
                className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
              />
            </div>
          </>
        )}
        {device.type === 'slider' && (
          <>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="min" className="text-right">
                Min Value
              </Label>
              <Input
                id="min"
                type="number"
                value={device.config.min || 0}
                onChange={(e) => setDevice({ ...device, config: { ...device.config, min: parseInt(e.target.value) } })}
                className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="max" className="text-right">
                Max Value
              </Label>
              <Input
                id="max"
                type="number"
                value={device.config.max || 100}
                onChange={(e) => setDevice({ ...device, config: { ...device.config, max: parseInt(e.target.value) } })}
                className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="step" className="text-right">
                Step
              </Label>
              <Input
                id="step"
                type="number"
                value={device.config.step || 1}
                onChange={(e) => setDevice({ ...device, config: { ...device.config, step: parseInt(e.target.value) } })}
                className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">
                Unit
              </Label>
              <Input
                id="unit"
                value={device.config.unit || ''}
                onChange={(e) => setDevice({ ...device, config: { ...device.config, unit: e.target.value } })}
                className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
              />
            </div>
          </>
        )}
        {device.type === 'button' && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="buttonMessage" className="text-right">
              Button Message
            </Label>
            <Input
              id="buttonMessage"
              value={device.config.buttonMessage || ''}
              onChange={(e) => setDevice({ ...device, config: { ...device.config, buttonMessage: e.target.value } })}
              className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            />
          </div>
        )}
        {device.type === 'read' && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">
              Unit
            </Label>
            <Input
              id="unit"
              value={device.config.unit || ''}
              onChange={(e) => setDevice({ ...device, config: { ...device.config, unit: e.target.value } })}
              className="col-span-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="submit">{initialDevice ? 'Update Device' : 'Add Device'}</Button>
      </DialogFooter>
    </form>
  )
}