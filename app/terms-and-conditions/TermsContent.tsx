"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { appName } from "@/lib/utils";
import Link from "next/link";
import { TenantPortalSettings } from "@/lib/types";


// Default configuration (same as in the provided page)
const DEFAULT_CONFIG: TenantPortalSettings = {
  branding: {
    logo: "",
    primaryColor: "#3B82F6",
    secondaryColor: "#1E40AF",
    businessName: "NetBill WiFi",
  },
  support: {
    phone: "+254700000000",
    email: "support@example.com",
    whatsapp: "",
    showOnPortal: true,
  },
  portalSettings: {
    displayMode: "both",
    welcomeMessage: "Welcome! Select a package or enter your voucher code to get connected.",
    termsUrl: "",
    showPoweredBy: true,
  },
  currency: "TZS",
  language: "en",
};

// Translation labels matching the format from the provided page
export const termsLabels: Record<string, any> = {
  en: {
    title: "Terms and Conditions",
    lastUpdated: "Last Updated: April 27, 2026",
    intro: "Please read these terms and conditions carefully before using our Wi-Fi hotspot service.",
    sections: [
      {
        title: "Acceptance of Terms",
        content:
          "By connecting to the {businessName} Wi-Fi network, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please disconnect from the network immediately.",
      },
      {
        title: "Permitted Use",
        content:
          "This service is provided for lawful purposes only. You agree to use the Wi-Fi service for legitimate activities including web browsing, email, messaging, and work-related tasks. You shall not use the service for any illegal, harmful, or disruptive activities.",
        bulletPoints: [
          "General web browsing and email",
          "Streaming at speeds provided by your package",
          "Social media and educational content",
          "Remote work and business communications",
        ],
      },
      {
        title: "Prohibited Activities",
        content:
          "The following activities are strictly prohibited while using our Wi-Fi service:",
        bulletPoints: [
          "Illegal downloads or distribution of copyrighted material",
          "Hacking, port scanning, or any attempt to compromise network security",
          "Sending spam, phishing emails, or malicious content",
          "Accessing or distributing adult content, hate speech, or violent material",
          "Interfering with other users' ability to enjoy the service",
          "Reselling or sharing your connection without authorization",
        ],
      },
      {
        title: "Service Limitations",
        content:
          "While we strive to provide reliable service, we do not guarantee uninterrupted, error-free, or secure access. Service quality may be affected by:",
        bulletPoints: [
          "Network congestion and number of active users",
          "Weather conditions affecting wireless signals",
          "Maintenance and upgrades (scheduled maintenance will be announced)",
          "Issues with upstream internet service providers",
          "Your device's hardware or software limitations",
        ],
      },
      {
        title: "Payments and Vouchers",
        content:
          "Access to our Wi-Fi service requires valid payment through vouchers or electronic payments. All sales are final and non-refundable unless there is a proven technical fault on our end. Vouchers expire after their specified validity period and cannot be extended or refunded.",
      },
      {
        title: "Privacy and Data Collection",
        content:
          "When you use our service, we may collect certain information including your device's MAC address, IP address, connection timestamps, and bandwidth usage for billing and network management purposes. We do not monitor your browsing history or personal communications. We will not share your personal data with third parties except as required by law.",
      },
      {
        title: "Limitation of Liability",
        content:
          "To the maximum extent permitted by law, {businessName} shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use or inability to use the Wi-Fi service. This includes loss of data, loss of revenue, or any other damages resulting from service interruptions.",
      },
      {
        title: "Service Suspension",
        content:
          "We reserve the right to suspend or terminate your access to the Wi-Fi service at any time if you violate these Terms and Conditions, fail to make required payments, or if your usage poses a security risk to our network. You will be notified of such suspension when possible.",
      },
      {
        title: "Changes to Terms",
        content:
          "We may update these Terms and Conditions from time to time. The revised version will be posted on this page with an updated 'Last Updated' date. Your continued use of the service after any changes constitutes acceptance of the new terms.",
      },
      {
        title: "Governing Law",
        content:
          "These Terms and Conditions shall be governed by and construed in accordance with the laws of the United Republic of Tanzania. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of Tanzanian courts.",
      },
    ],
    contactUs: "Contact Us",
    contactInfo: "If you have any questions about these Terms and Conditions, please contact us:",
    backButton: "← Back to Portal",
    poweredBy: "Powered by",
    agreeAndContinue: "I Agree to the Terms",
    agreeDisclaimer:
      "By clicking 'Agree and Continue', you confirm that you have read and accepted these Terms and Conditions.",
    loading: "Loading...",
    termsAndConditions: "Terms and Conditions",
  },
  sw: {
    title: "Masharti na Sheria za Matumizi",
    lastUpdated: "Iliyosasishwa Mwisho: Aprili 27, 2026",
    intro:
      "Tafadhali soma masharti haya kwa makini kabla ya kutumia huduma yetu ya Wi-Fi hotspot.",
    sections: [
      {
        title: "Kukubali Masharti",
        content:
          "Kwa kuunganisha kwenye mtandao wa Wi-Fi wa {businessName}, unakubali kuwa umesoma, kuelewa, na unakubali kufungwa na Masharti na Sheria hizi. Ikiwa hukubaliani na sehemu yoyote ya masharti haya, tafadhali jiondoe kwenye mtandao mara moja.",
      },
      {
        title: "Matumizi Yanayoruhusiwa",
        content:
          "Huduma hii inatolewa kwa madhumuni halali tu. Unakubali kutumia huduma ya Wi-Fi kwa shughuli halali ikiwemo kuvinjari wavuti, barua pepe, ujumbe mfupi, na kazi zinazohusiana na kazi. Hutatumia huduma kwa shughuli zisizo halali, hatari, au zinazovuruga.",
        bulletPoints: [
          "Kuvinjari wavuti na barua pepe kwa ujumla",
          "Kusimamisha video kwa kasi inayotolewa na bando lako",
          "Mitandao ya kijamii na maudhui ya kielimu",
          "Kazi za mbali na mawasiliano ya biashara",
        ],
      },
      {
        title: "Shughuli Zilizopigwa Marufuku",
        content:
          "Shughuli zifuatazo zimepigwa marufuku kabisa wakati wa kutumia huduma yetu ya Wi-Fi:",
        bulletPoints: [
          "Kupakua au kusambaza nyenzo za hakimiliki isivyo halali",
          "Kuvunja au kujaribu kuvunja usalama wa mtandao",
          "Kutuma barua taka, barua pepe za ulaghai, au maudhui mabaya",
          "Kufikia au kusambaza maudhui ya watu wazima, matusi ya chuki, au vurugu",
          "Kuingilia uwezo wa watumiaji wengine kufurahia huduma",
          "Kuuza au kushiriki uunganisho wako bila idhini",
        ],
      },
      {
        title: "Vikwazo vya Huduma",
        content:
          "Ingawa tunajitahidi kutoa huduma ya kuaminika, hatuhakikishi ufikiaji usiokatizwa, usio na makosa, au salama. Ubora wa huduma unaweza kuathiriwa na:",
        bulletPoints: [
          "Msongamano wa mtandao na idadi ya watumiaji hai",
          "Hali ya hewa inayoathiri mawimbi ya wireless",
          "Matengenezo na uboreshaji (matengenezo yaliyopangwa yatatangazwa)",
          "Masuala na watoa huduma wa mtandao",
          "Vikwazo vya hardware au software ya kifaa chako",
        ],
      },
      {
        title: "Malipo na Vocha",
        content:
          "Ufikiaji wa huduma yetu ya Wi-Fi unahitaji malipo halali kupitia vocha au malipo ya kielektroniki. Mauzo yote ni ya mwisho na hayarejeshewi isipokuwa kwa hitilafu ya kiufundi iliyothibitishwa kutoka upande wetu. Vocha huisha muda baada ya muda wao maalum na haziwezi kurefushwa au kurejeshwa.",
      },
      {
        title: "Faragha na Ukusanyaji wa Data",
        content:
          "Unapotumia huduma yetu, tunaweza kukusanya taarifa fulani ikiwemo anwani ya MAC ya kifaa chako, anwani ya IP, muda wa kuunganisha, na matumizi ya bandwidth kwa madhumuni ya bili na usimamizi wa mtandao. Hatufuatilii historia yako ya kuvinjari au mawasiliano yako binafsi. Hatutashiriki data yako binafsi na watu wengine isipokuwa kama inavyotakiwa na sheria.",
      },
      {
        title: "Ukomo wa Dhima",
        content:
          "Kwa kiwango cha juu kinachoruhusiwa na sheria, {businessName} haitawajibika kwa uharibifu wowote wa moja kwa moja, usio wa moja kwa moja, wa kubahatisha, wa matokeo, au wa adhabu unaotokana na matumizi yako au kutoweza kutumia huduma ya Wi-Fi. Hii inajumuisha upotezaji wa data, upotezaji wa mapato, au uharibifu mwingine wowote unaotokana na usumbufu wa huduma.",
      },
      {
        title: "Kusitisha Huduma",
        content:
          "Tunahifadhi haki ya kusitisha au kukomesha ufikiaji wako wa huduma ya Wi-Fi wakati wowote ikiwa utakiuka Masharti na Sheria hizi, kushindwa kufanya malipo yanayohitajika, au ikiwa matumizi yako yanaleta hatari ya usalama kwenye mtandao wetu. Utajulishwa kuhusu kusitishwa huku iwezekanavyo.",
      },
      {
        title: "Mabadiliko ya Masharti",
        content:
          "Tunaweza kusasisha Masharti na Sheria hizi mara kwa mara. Toleo lililosasishwa litatolewa kwenye ukurasa huu na tarehe iliyosasishwa ya 'Iliyosasishwa Mwisho'. Kuendelea kutumia huduma baada ya mabadiliko yoyote kunamaanisha kukubali masharti mapya.",
      },
      {
        title: "Sheria Zinazotumika",
        content:
          "Masharti na Sheria hizi zitatawaliwa na kufasiriwa kwa mujibu wa sheria za Jamhuri ya Muungano wa Tanzania. Migogoro yoyote inayotokana na masharti haya itakuwa chini ya mamlaka ya kipekee ya mahakama za Tanzania.",
      },
    ],
    contactUs: "Wasiliana Nasi",
    contactInfo:
      "Ikiwa una maswali yoyote kuhusu Masharti na Sheria hizi, tafadhali wasiliana nasi:",
    backButton: "← Rudi kwenye Ukurasa wa Kuingia",
    poweredBy: "Imedhaminiwa na",
    agreeAndContinue: "Nakubali Masharti",
    agreeDisclaimer:
      "Kwa kubonyeza 'Nakubali na Kuendelea', unathibitisha kuwa umesoma na kukubali Masharti na Sheria hizi.",
    loading: "Inapakia...",
    termsAndConditions: "Masharti na Sheria",
  },
};

export default function TermsPage() {
  const searchParams = useSearchParams();
  // Get parameters from URL (same as CaptivePortalClient)
  const nasName = searchParams.get("nasname") ?? "";
  const authToken = searchParams.get("token") ?? "";

  const [config, setConfig] = useState<TenantPortalSettings>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  // Load configuration from API - exactly as in the provided CaptivePortalClient
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Same API call as in the provided page
        const cfg = await apiClient.portal.getConfig(nasName, authToken);
        // Handle response structure like the original: cfg.data ?? cfg
        const loadedConfig = cfg.data ?? cfg;
        setConfig(loadedConfig);
      } catch (error) {
        console.error("Failed to load portal config:", error);
        // Keep default config on error
        setConfig(DEFAULT_CONFIG);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [nasName, authToken]);

  // Get labels based on config language (same as original page)
  const labels = termsLabels[config.language] || termsLabels.en;
  const { primaryColor, secondaryColor, businessName, logo } = config.branding;

  // CSS variables for theming (mirroring the original portalVars)
  const portalVars = {
    "--portal-primary": primaryColor,
    "--portal-secondary": secondaryColor,
    "--portal-primary-10": `${primaryColor}1a`,
  } as React.CSSProperties;

  // Format content with business name placeholder
  const formatContent = (content: string) => {
    return content.replace(/{businessName}/g, businessName);
  };

  
  // Loading state - matches the original page's loading spinner style
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="h-8 w-8 rounded-full border-[3px] animate-spin"
          style={{
            borderColor: `${primaryColor}33`,
            borderTopColor: primaryColor,
          }}
        />
        <span className="ml-3 text-muted-foreground">{labels.loading}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" style={portalVars}>
      <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header with brand primary color - matches original branding */}
          <div
            className="px-6 py-5 md:px-8"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 py-7">
                {/* Logo or icon */}
                { (
                  <div className="bg-white/20 rounded-full p-2">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12 18.75h.008v.008H12v-.008z"
                      />
                    </svg>
                  </div>
                )}
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {labels.title}
                </h1>
              </div>
              
            </div>
          </div>

          {/* Content Body */}
          <div className="p-6 md:p-8">
            {/* Intro */}
            <div className="mb-6 p-4 bg-amber-50 rounded-lg border-l-4" style={{ borderLeftColor: primaryColor }}>
              <p className="text-sm text-gray-700">{labels.intro}</p>
            </div>

            {/* Language indicator - shows current language from config */}
            <div className="flex justify-end mb-6">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">
                  {config.language === "sw" ? "Kiswahili" : "English"}
                </span>
                <span className="text-xs">✓</span>
              </div>
            </div>

            {/* Terms Sections */}
            <div className="space-y-6">
              {labels.sections.map((section: any, idx: number) => (
                <div key={idx} className="border-b border-gray-100 pb-5 last:border-0">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span
                      className="inline-block w-1.5 h-6 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    {section.title}
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    {formatContent(section.content)}
                  </p>
                  {section.bulletPoints && (
                    <ul className="space-y-1.5 mt-2 ml-4">
                      {section.bulletPoints.map((point: string, i: number) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                            style={{ backgroundColor: primaryColor }}
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            

            
            {/* Disclaimer and Agree Button */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="invisible rounded-lg p-4 mb-4" style={{ backgroundColor: `${primaryColor}10` }}>
                <p className="text-xs" style={{ color: primaryColor }}>
                  {labels.agreeDisclaimer}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <button
                  className="invisible w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: primaryColor }}
                >
                  {labels.agreeAndContinue}
                </button>
                <Link
                  href={`/pay?${searchParams.toString()}`}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {labels.backButton}
                </Link>
              </div>
            </div>

            {/* Powered by - matches original page with showPoweredBy config */}
            {config.portalSettings.showPoweredBy && (
              <div className="mt-8 text-center">
                <p className="text-xs text-gray-400">
                  {labels.poweredBy}{" "}
                  <span className="font-medium">{appName || businessName}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}