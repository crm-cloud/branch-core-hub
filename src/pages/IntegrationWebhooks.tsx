import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WebhookActivityPanel } from '@/components/integrations/WebhookActivityPanel';

export default function IntegrationWebhooks() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <Button asChild variant="outline" size="icon" className="rounded-xl mt-1">
              <Link to="/integrations" aria-label="Back to integrations">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
                <Activity className="h-7 w-7 text-primary" />
                Webhook Activity
              </h1>
              <p className="text-muted-foreground mt-1">
                Every payment webhook delivery, signature verification, and HTTP outcome.
              </p>
            </div>
          </div>
        </div>

        <WebhookActivityPanel />
      </div>
    </AppLayout>
  );
}
