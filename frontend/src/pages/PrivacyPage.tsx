import { ArrowLeft } from 'lucide-react'

interface PrivacyPageProps {
  onBack?: () => void
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 15, 2026</p>

        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
            <p>
              This Privacy Policy describes how AutoPay Protocol ("we," "us," "our") collects, uses, stores, and protects information when you use our Interface, Protocol, SDK, API, and related services (collectively, "Services"). We are committed to protecting your privacy and handling your data transparently.
            </p>
            <p>
              AutoPay is a non-custodial protocol. We minimize the data we collect and do not require traditional account creation (usernames, passwords, or email addresses) to use the core Services. Your blockchain wallet address serves as your identity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Data Controller</h2>
            <p>
              AutoPay Protocol is the data controller for information processed through the Relayer and Interface. For questions about data processing, contact us at <a href="mailto:autopayprotocol@proton.me" className="text-primary hover:underline">autopayprotocol@proton.me</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Information We Collect</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">3.1 Blockchain Data (Public)</h3>
            <p>
              When you interact with the Protocol's smart contracts, the following data is recorded on public blockchains and indexed by our Relayer:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Wallet addresses (payer and merchant)</li>
              <li>Policy details (charge amount, billing interval, spending cap)</li>
              <li>Transaction hashes and block numbers</li>
              <li>Charge amounts and protocol fees</li>
              <li>Policy creation, revocation, and cancellation events</li>
            </ul>
            <p>
              This data is inherently public on the blockchain. Our Relayer indexes this data to provide the Interface and API services. We cannot delete data that exists on public blockchains.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">3.2 Subscriber Information (Optional, Merchant-Configured)</h3>
            <p>
              During checkout, Merchants may configure their plans to collect optional subscriber information. If a Merchant requests it, you may be asked to provide:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address</li>
              <li>Name</li>
              <li>Discord username</li>
              <li>Telegram username</li>
              <li>Twitter/X handle</li>
              <li>Mobile phone number</li>
            </ul>
            <p>
              This information is stored in our Relayer database and made accessible to the Merchant for whom you subscribed. Providing this information is only required if the Merchant has configured it as mandatory for their plan. You may choose not to subscribe if you do not wish to share this data.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">3.3 Merchant Account Data</h3>
            <p>
              Merchants who create plans through the API may provide:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Business name and website URL</li>
              <li>Support email address</li>
              <li>Logo image (PNG, JPEG, GIF, or WebP; max 512KB)</li>
              <li>Webhook endpoint URL</li>
              <li>Plan metadata (name, description, features, billing terms)</li>
              <li>Terms of service and privacy policy URLs</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">3.4 Authentication Data</h3>
            <p>
              When Merchants authenticate via the API, we process:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Wallet address</li>
              <li>EIP-191 cryptographic signatures (used for authentication, not stored after verification)</li>
              <li>API key hashes (SHA-256; plaintext keys are never stored after creation)</li>
              <li>Authentication timestamps</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">3.5 Terms Acceptance Records</h3>
            <p>
              When you accept our Terms of Service, we record:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Wallet address</li>
              <li>Terms version accepted</li>
              <li>Timestamp of acceptance</li>
              <li>Cryptographic signature of acceptance</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">3.6 Waitlist Data</h3>
            <p>
              If you sign up for our waitlist, we collect your email address and the date of submission.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">3.7 Technical Data</h3>
            <p>
              Our hosting providers (Vercel for the Interface, Railway for the Relayer) may automatically collect:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP addresses (used for geoblocking/sanctions compliance)</li>
              <li>Request logs (URLs accessed, timestamps, HTTP methods)</li>
              <li>Browser user agent strings</li>
            </ul>
            <p>
              We use an offline IP geolocation database (geoip-lite) for sanctions compliance. IP geolocation is performed locally on our servers — no data is sent to external geolocation services.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">3.8 Data We Do NOT Collect</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>We do not use analytics services (no Google Analytics, Mixpanel, Segment, or similar)</li>
              <li>We do not use tracking pixels or advertising SDKs</li>
              <li>We do not set cookies (wallet state is managed by your browser's wallet extension)</li>
              <li>We do not collect passwords or create user accounts</li>
              <li>We do not access, store, or process your private keys or seed phrases</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. How We Use Your Information</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                  <th className="text-left py-2 pr-4 font-medium">Data Used</th>
                  <th className="text-left py-2 font-medium">Legal Basis (GDPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-4">Execute recurring charges</td>
                  <td className="py-2 pr-4">Wallet addresses, policy data</td>
                  <td className="py-2">Contract performance</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Display subscription dashboard</td>
                  <td className="py-2 pr-4">Indexed blockchain data</td>
                  <td className="py-2">Contract performance</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Deliver subscriber data to Merchants</td>
                  <td className="py-2 pr-4">Subscriber info (email, name, etc.)</td>
                  <td className="py-2">Consent (provided at checkout)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Authenticate Merchants</td>
                  <td className="py-2 pr-4">Wallet signatures, API key hashes</td>
                  <td className="py-2">Contract performance</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Sanctions compliance / geoblocking</td>
                  <td className="py-2 pr-4">IP addresses</td>
                  <td className="py-2">Legal obligation</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Send webhook notifications</td>
                  <td className="py-2 pr-4">Policy and charge data</td>
                  <td className="py-2">Contract performance</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Publish plan metadata to IPFS</td>
                  <td className="py-2 pr-4">Plan metadata (merchant name, plan details)</td>
                  <td className="py-2">Consent (merchant-initiated)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Record Terms acceptance</td>
                  <td className="py-2 pr-4">Wallet address, signature, timestamp</td>
                  <td className="py-2">Legal obligation</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Storage and Retention</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">5.1 Relayer Database</h3>
            <p>
              Operational data (policies, charges, merchant configurations) is stored in a PostgreSQL database hosted on Supabase. Row-level security (RLS) is enabled, restricting which data is accessible through different access paths.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">5.2 IPFS/Filecoin</h3>
            <p>
              When Merchants publish plans, the plan metadata is uploaded to IPFS via Storacha and pinned on the Filecoin network. <strong>Data stored on IPFS/Filecoin is permanent, immutable, and publicly accessible.</strong> It cannot be modified or deleted after upload. Do not include personal information in plan metadata that you would later want removed.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">5.3 Blockchain</h3>
            <p>
              All transactions executed through the Protocol are permanently recorded on public blockchains. This data is immutable and cannot be erased, modified, or restricted. Wallet addresses recorded on-chain may constitute personal data under GDPR if they can be linked to an identified individual.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">5.4 Browser Storage</h3>
            <p>
              The Interface stores minimal data in your browser's localStorage:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Terms acceptance status (per wallet address and version)</li>
              <li>Custom relayer configuration (if set by merchant users)</li>
            </ul>
            <p>You can clear this data at any time through your browser settings.</p>

            <h3 className="text-lg font-medium mt-4 mb-2">5.5 Retention Periods</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Blockchain data:</strong> Permanent (immutable by nature)</li>
              <li><strong>IPFS/Filecoin data:</strong> Permanent (immutable by design)</li>
              <li><strong>Subscriber personal data:</strong> Retained while the associated subscription policy is active, plus 90 days after revocation or cancellation, then deleted</li>
              <li><strong>Merchant account data:</strong> Retained while the Merchant has active plans, plus 1 year after all plans are archived</li>
              <li><strong>Terms acceptance records:</strong> Retained for the duration of the Services</li>
              <li><strong>Waitlist emails:</strong> Retained until the waitlist is closed or you request removal</li>
              <li><strong>Server logs:</strong> Per hosting provider retention policies (typically 30 days)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Sharing and Third Parties</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">6.1 Merchants</h3>
            <p>
              Subscriber information you provide during checkout is shared with the Merchant for whom you created a subscription. Merchants are responsible for their own use of this data and should have their own privacy policies.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">6.2 Service Providers (Sub-processors)</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Provider</th>
                  <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                  <th className="text-left py-2 font-medium">Data Shared</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-4">Supabase</td>
                  <td className="py-2 pr-4">Database hosting, object storage</td>
                  <td className="py-2">All Relayer database contents</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Railway</td>
                  <td className="py-2 pr-4">Relayer hosting</td>
                  <td className="py-2">Server logs, environment variables</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Vercel</td>
                  <td className="py-2 pr-4">Interface hosting</td>
                  <td className="py-2">Request logs, IP addresses</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Storacha (web3.storage)</td>
                  <td className="py-2 pr-4">IPFS/Filecoin storage</td>
                  <td className="py-2">Plan metadata, charge receipts</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Blockchain RPCs (Alchemy, public)</td>
                  <td className="py-2 pr-4">Blockchain data access</td>
                  <td className="py-2">Transaction hashes, contract calls</td>
                </tr>
              </tbody>
            </table>

            <h3 className="text-lg font-medium mt-4 mb-2">6.3 Third-Party Services in the Interface</h3>
            <p>The following third-party services are integrated into the Interface and may process your data according to their own privacy policies:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>LiFi:</strong> When you bridge funds, your wallet address and transaction data are processed by LiFi's infrastructure.</li>
              <li><strong>WalletConnect:</strong> When connecting a wallet via WalletConnect, connection data is transmitted through WalletConnect's relay servers.</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">6.4 No Sale of Personal Data</h3>
            <p>
              We do not sell, rent, or trade your personal information to third parties for marketing or advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Your Rights</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">7.1 Under GDPR (EU/EEA Users)</h3>
            <p>If you are in the EU/EEA, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate data.</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data, subject to our legal obligations and the immutability of blockchain and IPFS data.</li>
              <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances.</li>
              <li><strong>Portability:</strong> Request your data in a structured, machine-readable format.</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests.</li>
              <li><strong>Withdraw consent:</strong> Where processing is based on consent, you may withdraw it at any time.</li>
            </ul>
            <p>
              <strong>Important limitation:</strong> Due to the immutable nature of blockchain technology, we cannot erase or modify data that has been recorded on public blockchains or uploaded to IPFS/Filecoin. We can delete your off-chain data (subscriber information, Relayer database records) upon request. To exercise your rights, contact <a href="mailto:autopayprotocol@proton.me" className="text-primary hover:underline">autopayprotocol@proton.me</a>.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">7.2 Under CCPA (California Users)</h3>
            <p>If you are a California resident, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Know:</strong> Request disclosure of the categories and specific pieces of personal information collected about you.</li>
              <li><strong>Delete:</strong> Request deletion of personal information collected from you, subject to blockchain immutability.</li>
              <li><strong>Opt-out of sale:</strong> We do not sell personal information.</li>
              <li><strong>Non-discrimination:</strong> We will not discriminate against you for exercising your rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Security</h2>
            <p>We implement the following security measures:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Row-level security (RLS) on all database tables</li>
              <li>API key hashing (SHA-256) — plaintext keys are never stored</li>
              <li>HMAC-SHA256 signed webhooks with constant-time signature comparison</li>
              <li>Rate limiting on all authenticated and sensitive API endpoints</li>
              <li>SVG file upload rejection to prevent XSS attacks</li>
              <li>EIP-191 signature verification for merchant authentication with single-use, time-limited nonces</li>
              <li>Input validation and sanitization on all API inputs</li>
            </ul>
            <p>
              While we take reasonable precautions to protect your data, no system is completely secure. We cannot guarantee absolute security against sophisticated attacks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. International Data Transfers</h2>
            <p>
              Your data may be processed in jurisdictions outside your country of residence, including by our hosting providers (Supabase, Railway, Vercel). By using the Services, you consent to the transfer of your data to these jurisdictions. Where required, we rely on standard contractual clauses or other lawful transfer mechanisms for cross-border data transfers.
            </p>
            <p>
              Blockchain data is processed by a globally distributed network of nodes and is not confined to any single jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Children's Privacy</h2>
            <p>
              The Services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child under 18, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated through the Interface. The "Last updated" date at the top indicates when the policy was last revised. Your continued use of the Services after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">12. Contact</h2>
            <p>
              For privacy-related inquiries, data access requests, or to exercise your rights, contact us at:
            </p>
            <p className="mt-2">
              <strong>Email:</strong> <a href="mailto:autopayprotocol@proton.me" className="text-primary hover:underline">autopayprotocol@proton.me</a>
            </p>
            <p>
              We will respond to verified requests within 30 days.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
