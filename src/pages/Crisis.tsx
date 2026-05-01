import React from 'react';
import { ArrowLeft, Phone, Globe, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CRISIS_RESOURCES = [
  {
    country: "Nigeria Contacts",
    resources: [
      { name: "ASIDO", type: "call", contact: "+2349028080416" },
      { name: "SURPIN", type: "call", contact: "08111 909 909" }
    ]
  },
  {
    country: "International",
    resources: [
      { name: "Befrienders Worldwide", type: "website", contact: "www.befrienders.org", link: "https://www.befrienders.org" },
      { name: "Crisis Text Line", type: "text", contact: "Text HOME to 741741" }
    ]
  }
];

const Crisis = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-red-50 dark:bg-red-950/20 p-6 space-y-8 max-w-md mx-auto">
      <header className="flex items-center pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px] text-red-900 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900/40">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </header>

      <main className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-red-900 dark:text-red-100">You are not alone.</h1>
          <p className="text-red-800 dark:text-red-200 text-lg">
            If you are experiencing a crisis or feeling overwhelmed, please reach out for immediate support. There are people who want to help you.
          </p>
        </div>

        <div className="space-y-6 mt-8">
          {CRISIS_RESOURCES.map((region, idx) => (
            <div key={idx} className="space-y-3">
              <h2 className="font-semibold text-red-900/80 dark:text-red-200/80 uppercase tracking-wide text-sm">{region.country}</h2>
              {region.resources.map((res, i) => (
                <div key={i} className="bg-white dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50 shadow-sm flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{res.name}</h3>
                    <p className="text-muted-foreground text-sm flex items-center mt-1">
                      {res.type === 'call' && <Phone className="w-3 h-3 mr-1.5" />}
                      {res.type === 'website' && <Globe className="w-3 h-3 mr-1.5" />}
                      {res.type === 'text' && <MessageSquare className="w-3 h-3 mr-1.5" />}
                      {res.type === 'call' ? (
                        <a href={`tel:${res.contact.replace(/\s/g, '')}`} className="underline font-medium">{res.contact}</a>
                      ) : (
                        res.contact
                      )}
                    </p>
                  </div>
                  {res.link && (
                    <a href={res.link} target="_blank" rel="noreferrer" className="text-red-600 font-medium text-sm">
                      Visit
                    </a>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Crisis;
