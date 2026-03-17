import { ArrowLeft } from 'lucide-react'

interface TermsPageProps {
  onBack?: () => void
}

export function TermsPage({ onBack }: TermsPageProps) {
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

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 15, 2026</p>

        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>
              By connecting a wallet to, accessing, or using the AutoPay Protocol interface ("Interface"), smart contracts ("Protocol"), SDK, API, or any related services (collectively, "Services"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Services.
            </p>
            <p>
              Your acceptance is recorded when you sign a message with your wallet confirming agreement to these Terms. This cryptographic signature constitutes a legally binding acceptance equivalent to a written signature.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Definitions</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>"Protocol"</strong> — The immutable PolicyManager smart contract(s) deployed on supported EVM-compatible blockchains that facilitate non-custodial recurring USDC payments.</li>
              <li><strong>"Interface"</strong> — The web application hosted at autopayprotocol.com and its subdomains that provides a user interface for interacting with the Protocol.</li>
              <li><strong>"Payer"</strong> — A user who creates subscription policies and authorizes recurring charges from their wallet.</li>
              <li><strong>"Merchant"</strong> — A user who receives payments through subscription policies created by Payers.</li>
              <li><strong>"Policy"</strong> — An on-chain subscription agreement specifying a Payer, Merchant, charge amount, billing interval, and spending cap.</li>
              <li><strong>"Relayer"</strong> — A backend service that indexes on-chain events and executes scheduled charges on behalf of the Protocol.</li>
              <li><strong>"USDC"</strong> — USD Coin, a stablecoin issued by Circle Internet Financial.</li>
              <li><strong>"We," "Us," "Our"</strong> — AutoPay Protocol and its operators.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Eligibility</h2>
            <p>To use the Services, you represent and warrant that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are at least 18 years of age or the age of majority in your jurisdiction, whichever is higher.</li>
              <li>You have the legal capacity and authority to enter into a binding agreement.</li>
              <li>You are not a resident of, located in, or organized under the laws of any jurisdiction subject to comprehensive economic sanctions, including but not limited to: North Korea, Iran, Syria, Russia, Belarus, Cuba, Myanmar, Venezuela, Sudan, South Sudan, Somalia, Libya, China, or any other jurisdiction restricted by the Protocol's geoblocking measures.</li>
              <li>You are not identified on any government sanctions list, including the U.S. Office of Foreign Assets Control (OFAC) Specially Designated Nationals list, the UK Office of Financial Sanctions Implementation (OFSI) list, or the EU consolidated sanctions list.</li>
              <li>You understand the inherent risks of cryptographic and blockchain-based systems and are financially and technically sophisticated enough to evaluate those risks.</li>
              <li>You will comply with all applicable laws and regulations in your jurisdiction, including anti-money laundering (AML) and know-your-customer (KYC) requirements where applicable.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Description of Services</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">4.1 Non-Custodial Payment Protocol</h3>
            <p>
              AutoPay is a non-custodial recurring payment protocol. USDC funds remain in the Payer's wallet at all times until a charge is executed. The Protocol never takes custody of user funds. When a charge occurs, USDC is transferred directly from the Payer's wallet to the Merchant's address in a single atomic transaction, with the protocol fee deducted.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">4.2 How It Works</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Wallet approval:</strong> Payers approve USDC spending to the PolicyManager smart contract. This is a standard ERC-20 approval and does not transfer funds.</li>
              <li><strong>Policy creation:</strong> Payers create subscription policies specifying the Merchant, charge amount, billing interval, and spending cap. The first payment is charged immediately upon policy creation.</li>
              <li><strong>Recurring charges:</strong> The Relayer executes subsequent charges according to the policy's interval. Charges will only succeed if the Payer has sufficient USDC balance and allowance.</li>
              <li><strong>Cancellation:</strong> Payers may revoke any policy at any time, immediately stopping all future charges.</li>
              <li><strong>Auto-cancellation:</strong> Policies are automatically cancelled after 3 consecutive failed charge attempts.</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">4.3 Cross-Chain Funding</h3>
            <p>
              The Interface integrates LiFi, a third-party bridge aggregation service, to allow Payers to transfer USDC from other blockchain networks to the consolidation chain. LiFi is an independent third-party service not operated or controlled by AutoPay. Your use of LiFi is subject to LiFi's own terms and conditions.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">4.4 Merchant Services</h3>
            <p>
              Merchants may create subscription plans, configure checkout flows, receive webhook notifications, and access subscriber data through the Relayer API. Merchants are limited to a maximum of 2 active plans per account. Merchants are solely responsible for delivering goods or services to their subscribers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Protocol Fees</h2>
            <p>
              A protocol fee of <strong>2.5%</strong> is deducted from each successful charge. The fee is calculated as the charge amount multiplied by 250 basis points (250/10,000). The Merchant receives the charge amount minus the protocol fee. Gas costs for executing charges are paid by the Relayer and are separate from the protocol fee.
            </p>
            <p>
              We reserve the right to modify the protocol fee with 30 days' advance notice. Any fee changes will be communicated through the Interface and will apply only to charges executed after the effective date. Changes to protocol fees require deployment of a new smart contract, as the existing contract's fee is immutable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. User Responsibilities</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">6.1 Wallet Security</h3>
            <p>
              You are solely responsible for the security of your private keys, seed phrases, and wallet credentials. We do not have access to your wallet and cannot recover lost credentials or reverse unauthorized transactions. Never share your private keys with anyone.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">6.2 USDC Approval</h3>
            <p>
              The Services require you to approve USDC spending to the PolicyManager smart contract. This approval enables the contract to execute charges according to active policies only. The PolicyManager enforces strict controls: each policy has a fixed charge amount, billing interval, and spending cap. The contract cannot charge beyond the parameters of active policies. You may revoke the ERC-20 approval at any time through your wallet or a third-party tool.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">6.3 Tax Obligations</h3>
            <p>
              You are solely responsible for determining and fulfilling your tax obligations arising from your use of the Services, including reporting, calculating, and paying any applicable taxes.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">6.4 Compliance</h3>
            <p>
              You must ensure that your use of the Services complies with all applicable laws and regulations in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Prohibited Activities</h2>
            <p>You agree not to use the Services to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Violate any applicable laws, regulations, or sanctions.</li>
              <li>Engage in fraud, money laundering, terrorist financing, or other illicit activity.</li>
              <li>Circumvent geographic restrictions, sanctions screening, or access controls.</li>
              <li>Create spam policies or engage in activities intended to disrupt the Protocol or Relayer.</li>
              <li>Attempt to exploit, attack, or compromise the smart contracts, Interface, or Relayer.</li>
              <li>Misrepresent your identity, eligibility, or the nature of your transactions.</li>
              <li>Use the Services on behalf of a sanctioned person or entity.</li>
              <li>Interfere with other users' access to or use of the Services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Merchant-Payer Relationship</h2>
            <p>
              AutoPay is a payment infrastructure provider, not a marketplace or merchant of record. We are not a party to any transaction between Merchants and Payers. We do not verify, endorse, or guarantee Merchants, their products, or their services.
            </p>
            <p>
              Disputes between Merchants and Payers regarding goods, services, refunds, or any other matter must be resolved directly between the parties. AutoPay bears no responsibility for such disputes. Blockchain transactions are irreversible once confirmed; refunds are the Merchant's responsibility and must be handled off-chain or via a separate on-chain transaction.
            </p>
            <p>
              Payers should review all subscription terms before creating a policy. Revoking a policy stops future charges but does not reverse past charges.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Usage Limits</h2>
            <p>The following limits apply to use of the Services:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Merchant plans:</strong> Each merchant account is limited to 2 active plans (plans with "draft" or "active" status). Archived plans do not count toward this limit.</li>
              <li><strong>Billing intervals:</strong> Minimum 1 minute, maximum 365 days per the smart contract.</li>
              <li><strong>API rate limits:</strong> The Relayer API enforces rate limits on authentication, plan management, and data queries. See the API documentation for specific limits.</li>
            </ul>
            <p>
              We reserve the right to modify these limits with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Risk Disclosures</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">10.1 Smart Contract Risks</h3>
            <p>
              The Protocol is governed by immutable smart contracts deployed on public blockchains. These contracts cannot be modified, upgraded, or paused after deployment. While the contracts have been designed with security best practices (including reentrancy guards and safe token transfer patterns), smart contracts may contain undiscovered vulnerabilities. There is no guarantee that the code is free of bugs. You use the Protocol at your own risk.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">10.2 Blockchain Risks</h3>
            <p>
              Blockchain transactions are irreversible once confirmed. Network congestion, gas price fluctuations, chain reorganizations, or network outages may delay or prevent transactions. Different blockchains have different security models, finality guarantees, and risk profiles.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">10.3 USDC Risks</h3>
            <p>
              USDC is a centralized stablecoin issued by Circle Internet Financial. Circle has the ability to freeze or blacklist addresses holding USDC, and to pause the USDC contract entirely. If your USDC is frozen by Circle, the Protocol will be unable to execute charges. The value of USDC is not guaranteed to maintain a 1:1 peg with the U.S. dollar.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">10.4 Cross-Chain Bridging Risks</h3>
            <p>
              Cross-chain bridges are among the highest-risk components in cryptocurrency. Over $2.5 billion has been lost historically through bridge exploits. When using LiFi or any bridge to transfer funds, you accept the risk that bridge smart contracts may be exploited, validators may be compromised, wrapped tokens may lose their backing, and funds may be lost permanently. AutoPay does not operate, control, or guarantee any bridge service.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">10.5 Regulatory Risks</h3>
            <p>
              The regulatory landscape for cryptocurrency and decentralized finance is evolving. Laws and regulations may change in ways that restrict, limit, or prohibit the use of the Services in your jurisdiction. You are responsible for monitoring applicable regulatory developments.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">10.6 No Financial Advice</h3>
            <p>
              Nothing in the Services constitutes financial, investment, tax, or legal advice. AutoPay does not recommend or endorse any digital asset, transaction, or strategy. You should consult qualified professionals before making financial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Third-Party Services</h2>
            <p>The Services integrate with the following third-party services, each governed by their own terms:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>LiFi:</strong> Cross-chain bridge aggregation. Transaction data and wallet addresses are shared with LiFi's infrastructure during bridge operations.</li>
              <li><strong>WalletConnect:</strong> Wallet connection relay service. Connection data may be transmitted through WalletConnect's infrastructure.</li>
              <li><strong>RainbowKit:</strong> Open-source wallet connection UI library.</li>
              <li><strong>IPFS/Filecoin (Storacha):</strong> Decentralized storage for plan metadata. Data uploaded to IPFS is permanent and publicly accessible.</li>
            </ul>
            <p>
              We are not responsible for the availability, security, privacy practices, or performance of any third-party service. Your use of third-party services is at your own risk and subject to their respective terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">12. Intellectual Property</h2>
            <p>
              The Interface, including its design, code, graphics, and documentation, is the property of AutoPay Protocol. The smart contract code is open-source and subject to its applicable open-source license. We grant you a limited, non-exclusive, revocable, non-transferable license to access and use the Interface for its intended purpose, subject to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">13. Disclaimers of Warranties</h2>
            <p className="uppercase font-medium">
              THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
            <p className="uppercase font-medium">
              WE DO NOT CONTROL THE PROTOCOL, WHICH OPERATES AUTONOMOUSLY THROUGH IMMUTABLE SMART CONTRACTS ON PUBLIC BLOCKCHAINS. WE DO NOT GUARANTEE THE CORRECTNESS, SECURITY, OR CONTINUED OPERATION OF THE SMART CONTRACTS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">14. Limitation of Liability</h2>
            <p className="uppercase font-medium">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL AUTOPAY PROTOCOL, ITS OPERATORS, DEVELOPERS, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICES, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="uppercase font-medium">
              OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICES SHALL NOT EXCEED THE TOTAL PROTOCOL FEES YOU HAVE PAID IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">15. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless AutoPay Protocol, its operators, developers, contributors, and affiliates from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from: (a) your use of the Services; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; (d) any dispute between you and a Merchant or Payer; or (e) your negligence or willful misconduct.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">16. Dispute Resolution</h2>
            <p>
              Any dispute arising from or relating to these Terms or the Services shall be resolved through binding arbitration in accordance with the rules of the applicable arbitration association in the jurisdiction of incorporation. You agree to waive your right to a jury trial and to participate in any class action or class-wide arbitration.
            </p>
            <p>
              Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement of intellectual property rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">17. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the applicable jurisdiction, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">18. Modifications</h2>
            <p>
              We reserve the right to modify these Terms at any time. Material changes will be communicated through the Interface at least 14 days before they take effect. Your continued use of the Services after the effective date constitutes acceptance of the modified Terms. If updated Terms require re-acceptance, you will be prompted to sign a new message with your wallet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">19. Termination</h2>
            <p>
              We may restrict, suspend, or terminate your access to the Interface at any time, with or without cause, with or without notice. Termination of Interface access does not affect your ability to interact directly with the Protocol's smart contracts. All provisions of these Terms that by their nature should survive termination shall survive, including disclaimers, limitations of liability, and indemnification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">20. Severability</h2>
            <p>
              If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">21. Entire Agreement</h2>
            <p>
              These Terms, together with the Privacy Policy, constitute the entire agreement between you and AutoPay Protocol regarding the Services and supersede all prior agreements, understandings, and communications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">22. Contact</h2>
            <p>
              For questions about these Terms, contact us at <a href="mailto:autopayprotocol@proton.me" className="text-primary hover:underline">autopayprotocol@proton.me</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
