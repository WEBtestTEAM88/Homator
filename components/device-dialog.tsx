interface DeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDevice: Device | null;
  onSubmit: (device: Device) => void;
}

const DeviceDialog = ({
  open,
  onOpenChange,
  initialDevice,
  onSubmit
}: DeviceDialogProps) => {
  const [device, setDevice] = useState<Device>(() => ({
    id: '',
    name: '',
    type: 'switch',
    topic: '',
    value: false,
    icon: 'power',
    config: {},
    ...initialDevice
  }));

  // Reset form when dialog opens with new device
  useEffect(() => {
    if (open && initialDevice) {
      setDevice({
        ...initialDevice,
        config: { ...initialDevice.config }
      });
    }
  }, [open, initialDevice]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialDevice ? 'Edit Device' : 'Add Device'}</DialogTitle>
          <DialogDescription>
            {initialDevice ? 'Modify the device settings below.' : 'Add a new device to your dashboard.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={device.name}
              onChange={(e) => setDevice({ ...device, name: e.target.value })}
              className="col-span-3"
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
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select device type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="switch">Switch</SelectItem>
                <SelectItem value="button">Button</SelectItem>
                <SelectItem value="slider">Slider</SelectItem>
                <SelectItem value="read">Read Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="topic" className="text-right">
              Topic
            </Label>
            <Input
              id="topic"
              value={device.topic}
              onChange={(e) => setDevice({ ...device, topic: e.target.value })}
              className="col-span-3"
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
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select icon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="power">Power</SelectItem>
                <SelectItem value="sun">Sun</SelectItem>
                <SelectItem value="moon">Moon</SelectItem>
                <SelectItem value="thermometer">Thermometer</SelectItem>
                <SelectItem value="fan">Fan</SelectItem>
                {/* Add more icons as needed */}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional config fields based on device type */}
          {device.type === 'switch' && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="onMessage" className="text-right">
                  ON Message
                </Label>
                <Input
                  id="onMessage"
                  value={device.config.onMessage || "ON"}
                  onChange={(e) => setDevice({
                    ...device,
                    config: { ...device.config, onMessage: e.target.value }
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="offMessage" className="text-right">
                  OFF Message
                </Label>
                <Input
                  id="offMessage"
                  value={device.config.offMessage || "OFF"}
                  onChange={(e) => setDevice({
                    ...device,
                    config: { ...device.config, offMessage: e.target.value }
                  })}
                  className="col-span-3"
                />
              </div>
            </>
          )}

          {device.type === 'button' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="buttonMessage" className="text-right">
                Message
              </Label>
              <Input
                id="buttonMessage"
                value={device.config.buttonMessage || "PRESS"}
                onChange={(e) => setDevice({
                  ...device,
                  config: { ...device.config, buttonMessage: e.target.value }
                })}
                className="col-span-3"
              />
            </div>
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
                  onChange={(e) => setDevice({
                    ...device,
                    config: { ...device.config, min: Number(e.target.value) }
                  })}
                  className="col-span-3"
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
                  onChange={(e) => setDevice({
                    ...device,
                    config: { ...device.config, max: Number(e.target.value) }
                  })}
                  className="col-span-3"
                />
              </div>
            </>
          )}

          {(device.type === 'slider' || device.type === 'read') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">
                Unit
              </Label>
              <Input
                id="unit"
                value={device.config.unit || ""}
                onChange={(e) => setDevice({
                  ...device,
                  config: { ...device.config, unit: e.target.value }
                })}
                className="col-span-3"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => {
            onSubmit(device);
            onOpenChange(false);
          }}>
            {initialDevice ? 'Save Changes' : 'Add Device'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 