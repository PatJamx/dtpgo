'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { EventWithDetails } from '@/lib/types/event';

interface DeleteEventDialogProps {
  event: EventWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteEventDialog({
  event,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: DeleteEventDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const counts = event._count ?? {
    attendance: 0,
    sessions: 0,
    organizerAssignments: 0,
  };

  // Check if event has attendance records
  const hasAttendance = counts.attendance > 0;
  const hasSessions = counts.sessions > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Event
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the event and all associated data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">{event.name}</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Start:</span> {new Date(event.startDate).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium">End:</span> {new Date(event.endDate).toLocaleDateString()}
              </p>
              {event.location && (
                <p>
                  <span className="font-medium">Location:</span> {event.location}
                </p>
              )}
            </div>
          </div>

          {/* Warning Messages */}
          {hasAttendance && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-red-800">Attendance Records Found</h5>
                  <p className="text-sm text-red-700 mt-1">
                    This event has {counts.attendance} attendance records. 
                    Deleting the event will also delete all attendance data.
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasSessions && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-yellow-800">Sessions Found</h5>
                  <p className="text-sm text-yellow-700 mt-1">
                    This event has {counts.sessions} sessions. 
                    All sessions and their data will be deleted.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Input */}
          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="text-sm font-medium text-gray-700">
              Type the event name to confirm deletion:
            </label>
            <input
              id="confirm-delete"
              type="text"
              placeholder={event.name}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isDeleting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete Event'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
