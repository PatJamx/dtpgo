'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublicRegisterForm } from '@/components/public/PublicRegisterForm';
import { StudentFormInput } from '@/lib/validations/student';
import { toast } from 'sonner';

export default function PublicJoinPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleRegistration = async (data: StudentFormInput) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/public/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        switch (response.status) {
          case 400: {
            if (typeof responseData.error === 'object') {
              const fieldErrors = Object.entries(responseData.error)
                .map(([field, errors]) => {
                  const messages = Array.isArray(errors)
                    ? errors.join(', ')
                    : String(errors);

                  return `${field}: ${messages}`;
                })
                .join('\n');

              toast.error('Please fix the following errors', {
                description: fieldErrors,
              });
            } else {
              toast.error(
                responseData.error ||
                  'Please check your information and try again.'
              );
            }
            break;
          }

          case 409:
            toast.error(
              responseData.error ||
                'A student with this information already exists.'
            );
            break;

          case 429:
            toast.error(
              'Too many registration attempts. Please wait a moment and try again.'
            );
            break;

          case 500:
            toast.error(
              responseData.message ||
                responseData.error ||
                'Server error. Please try again later.'
            );
            break;

          default:
            toast.error(
              responseData.error ||
                responseData.message ||
                'Registration failed. Please try again.'
            );
        }

        return;
      }

      const student = responseData.student;

      if (!student || !student.id) {
        toast.error(
          'Registration completed, but the student record could not be found.'
        );
        return;
      }

      toast.success('Registration successful!', {
        description: 'Redirecting to your QR code...',
      });

      setTimeout(() => {
        router.push(
          `/join/success?studentId=${encodeURIComponent(
            student.id
          )}&name=${encodeURIComponent(
            `${student.firstName} ${student.lastName}`
          )}`
        );
      }, 1000);
    } catch (error) {
      console.error('Registration error:', error);

      if (
        error instanceof TypeError &&
        error.message.toLowerCase().includes('fetch')
      ) {
        toast.error(
          'Network error. Please check your internet connection and try again.'
        );
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto max-w-2xl p-6">
      <PublicRegisterForm
        onSubmit={handleRegistration}
        isSubmitting={isSubmitting}
      />
    </main>
  );
}