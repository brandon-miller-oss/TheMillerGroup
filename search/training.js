/* =========================================================================
   The Miller Group: Road to Closed agent training.
   Short, Duolingo-style lessons along one road, built from The Miller Group
   2026 Road to Closed Training Guide. Each lesson: a quick "know this" card,
   then multiple-choice questions with an explanation after each answer.
   Missed questions come back at the end. XP and a daily streak carry over.
   Finish the road, then pass the Road test (80%) to get certified.
   Progress: agent/<uid>/crm/training/progress. The broker sees the team.
   ========================================================================= */
(function () {
  const T = window.Training = { view: "road", L: null, team: null };
  const today = () => new Date().toLocaleDateString("en-CA");
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString("en-CA"); };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ------------------------------------------------------------------ */
  /* Content. Each question: [prompt, [choices], correct index, why]     */
  /* ------------------------------------------------------------------ */
  const STAGES = [
    { id: "finance", title: "Financing fundamentals", part: "Part 1", lessons: [
      { id: "fha", title: "FHA loans", learn: ["Insured by the Federal Housing Administration; popular with first-time buyers.", "FICO 580+ with 3.5% down, or 500–579 with 10% down.", "Two years of verifiable work and income; primary residence only; FHA-approved appraiser.", "Debt ratios: about 31% front-end and 43% back-end (up to 50% in some cases).", "Loan limits vary by county and change every year. Check HUD’s lookup."], q: [
        ["Your buyer has a 600 credit score and wants FHA. What’s the minimum down payment?", ["3%", "3.5%", "10%", "20%"], 1, "FICO 580 or higher qualifies for 3.5% down. 500–579 requires 10% down."],
        ["A buyer with a 550 score asks if FHA is possible. What do you tell them?", ["No, FHA needs 620", "Yes, with 10% down", "Yes, with 3.5% down", "Only with a co-signer"], 1, "FHA allows scores of 500–579 with 10% down. Their lender confirms the details."],
        ["Which property can an FHA loan be used for?", ["A rental property", "A second home in the mountains", "The buyer’s primary residence", "A fix-and-flip"], 2, "FHA loans are for primary residences only."],
        ["What’s the guideline back-end debt ratio for FHA?", ["28%", "36%", "43%, up to 50% in some cases", "60%"], 2, "All monthly debt should be no more than 43% of gross monthly income, with exceptions up to 50%."],
        ["Where should you check current FHA loan limits?", ["Zillow", "HUD’s loan limit lookup, by county", "The listing agent", "Limits never change"], 1, "FHA limits vary by county and change annually. Use HUD’s lookup and confirm with a lender."]
      ] },
      { id: "conv", title: "Conventional, VA, and USDA", learn: ["Conventional: 620 minimum, 740+ for the best rates, as little as 3% down, no PMI at 20% down.", "A bigger conventional down payment can signal strength to a seller.", "VA: eligible service members, veterans, and surviving spouses. Usually no down payment, no PMI, limited closing costs, and a lifetime benefit.", "USDA: zero down in eligible rural and some suburban areas, with county income limits. Many suburban pockets qualify."], q: [
        ["What credit score usually earns the best conventional rates?", ["580", "620", "680", "740+"], 3, "620 is the minimum for conventional; 740+ gets the best pricing."],
        ["At what down payment does a conventional loan avoid PMI?", ["3%", "5%", "10%", "20%"], 3, "Private mortgage insurance generally goes away at 20% down."],
        ["Which statement about VA loans is true?", ["They can only be used once", "They require PMI", "They’re a lifetime benefit that can be reused", "They need 5% down"], 2, "VA eligibility is a lifetime benefit and can be used more than once."],
        ["A buyer wants zero down in a small town near Fort Lupton. Which loan should they ask a lender about?", ["Jumbo", "USDA", "5/1 ARM", "Conventional 97"], 1, "USDA offers zero down in eligible rural and some suburban areas, within income limits."],
        ["In a multiple-offer situation, why might a conventional offer with a larger down payment beat FHA?", ["FHA buyers can’t make offers", "It signals financial strength to the seller", "Conventional loans close in 7 days", "FHA requires the seller to pay closing costs"], 1, "Per the guide, a larger conventional down payment can read as financial strength to a seller."]
      ] },
      { id: "arm", title: "Jumbo loans and ARMs", learn: ["Jumbo: loans above the county’s conforming limit. Stricter credit, larger down payment, more reserves. Have clients shop several lenders.", "ARMs are named by fixed period / adjustment interval.", "5/1 = fixed 5 years, then adjusts every year. 5/5 = fixed 5 years, then adjusts every 5 years.", "ARMs can fit buyers who’ll sell or refinance before the fixed period ends, or who need a lower start payment.", "Make sure clients understand the caps and the highest possible payment."], q: [
        ["What does a 5/1 ARM mean?", ["Fixed 1 year, then adjusts every 5", "Fixed 5 years, then adjusts every year", "5% rate for 1 year", "Adjusts 5 times total"], 1, "First number is the fixed period; second is how often it adjusts after that."],
        ["When is a jumbo loan needed?", ["When the buyer has under 5% down", "When the loan exceeds the county’s conforming limit", "For any home over $500,000", "For condos"], 1, "Jumbo loans finance amounts above the FHFA conforming limit for that county."],
        ["Which buyer is the best fit for an ARM?", ["Plans to stay 30 years and hates risk", "Plans to sell in about 4 years", "Wants a payment that never changes", "Has no savings"], 1, "ARMs make sense for buyers likely to sell or refinance before the fixed period ends."],
        ["What must you make sure an ARM borrower understands?", ["The listing agent’s commission", "How adjustments work and the maximum payment caps", "Their HOA’s bylaws", "Nothing; that’s the lender’s job only"], 1, "The guide makes this the agent’s responsibility: clients must understand adjustments and caps."],
        ["Jumbo requirements vary a lot. What should you recommend?", ["Use the first lender they call", "Shop multiple lenders", "Avoid jumbo loans", "Pay cash"], 1, "Lender requirements vary significantly, so clients should compare."]
      ] },
      { id: "dpa", title: "Down payment assistance", learn: ["Programs and limits change every year. Always verify with an approved lender before advising.", "metroDPA (2026 guide): up to 6% of the first mortgage as a 3-year forgivable second at 0%; FHA, VA, conventional; income under $150,000; approved areas and lenders.", "CHFA: 620+ mid-score, income limits, homebuyer education before closing, $1,000 minimum buyer contribution, participating lender.", "CHAC: repayable second for first-time buyers, usually 80% AMI; due in full if the first mortgage is paid off or refinanced.", "Chenoa Fund: 3.5% or 5% assistance with FHA or some conventional; repaid if the buyer sells or refinances before forgiveness."], q: [
        ["Before telling a client they qualify for a DPA program, what should you do?", ["Quote last year’s limits", "Verify current limits with an approved lender", "Ask the listing agent", "Nothing; all buyers qualify"], 1, "These programs change annually. The guide says to verify with an approved lender first."],
        ["Which program requires a homebuyer education course and a $1,000 minimum buyer contribution?", ["CHFA", "USDA", "VA", "Jumbo"], 0, "CHFA requires an approved homebuyer course before closing and at least $1,000 from the borrower."],
        ["Your CHAC buyer refinances their first mortgage. What happens to the CHAC loan?", ["It’s forgiven", "Nothing", "It becomes due in full", "It converts to a grant"], 2, "CHAC loans become due in full if the first mortgage is paid off or refinanced."],
        ["How is metroDPA assistance structured, per the 2026 guide?", ["A 30-year loan at 7%", "A 3-year forgivable second at 0% interest", "A cash grant at closing with no lien", "A credit card"], 1, "metroDPA assistance is a 3-year forgivable second mortgage at 0% with no anticipated repayment."],
        ["A Chenoa Fund buyer sells before the second is forgiven. What happens?", ["The second must be repaid", "It’s forgiven anyway", "The seller pays it", "The agent pays it"], 0, "Chenoa’s second must be repaid if the buyer sells or refinances before forgiveness."]
      ] }
    ] },
    { id: "buyer", title: "The buyer side", part: "Part 2", lessons: [
      { id: "disclose", title: "Disclosures come first", learn: ["C.R.S. 12-10-408: written disclosures come before eliciting or discussing any confidential information.", "This applies at or before the first meeting with any consumer, client or not.", "First: Definitions of Working Relationships / Broker Disclosure to Buyer, and the Affiliated Business Arrangement Disclosure.", "Then secure the client: Exclusive Right-to-Buy, Mold Disclosure, Wire Fraud Disclosure, radon pamphlet, and lead-based paint if it applies."], q: [
        ["A new buyer starts telling you their maximum budget before anything is signed. What should happen first?", ["Keep listening and take notes", "Complete Definitions of Working Relationships and the Affiliated Business disclosure", "Sign the Exclusive Right-to-Buy only", "Send them to a lender"], 1, "Disclosures come before any confidential discussion. Pause and get them done."],
        ["Which Colorado statute requires disclosure before confidential discussion?", ["C.R.S. 38-35-109", "C.R.S. 12-10-408", "RESPA Section 8", "The ADA"], 1, "The guide cites C.R.S. 12-10-408."],
        ["Do the disclosure rules apply if the person never becomes your client?", ["No, only clients", "Yes, they apply to any consumer at or before the first meeting", "Only for sellers", "Only in Denver"], 1, "They must be completed at or before your first meeting with any consumer."],
        ["Which of these secures the buyer as your client after disclosures?", ["Exclusive Right-to-Buy Contract", "Seller’s Property Disclosure", "Closing Instructions", "Listing Sales Information Sheet"], 0, "The Exclusive Right-to-Buy establishes the agency relationship and compensation."],
        ["Which pamphlet goes to every buyer when you secure the client?", ["Radon and Real Estate Transactions", "FHA Loan Limits", "HOA Bylaws", "Seller’s Net Sheet"], 0, "The radon pamphlet is on the guide’s list, along with mold, wire fraud, and lead-based paint if applicable."]
      ] },
      { id: "prep", title: "The buyer packet and preparing your buyer", learn: ["Keep pre-made packets: buying basics, a timeline, showing/inspection/appraisal rules, a blank sample Exclusive Right-to-Buy, both disclosures.", "Include at least three lenders, three inspectors, and three home warranty companies, in alphabetical order.", "Sample contracts stay blank, with no client names.", "Before showings, verify with the lender: pre-approval and conditions, budget including HOA dues, proof of funds for large cash down payments.", "Set up the MLS portal search and note must-haves vs. negotiables."], q: [
        ["How should recommended lenders appear in the buyer packet?", ["Your favorite first", "At least three, in alphabetical order", "Only the in-house lender", "However the client prefers"], 1, "At least three, alphabetical. It also keeps your recommendations RESPA-friendly."],
        ["The sample Exclusive Right-to-Buy in your packet should be…", ["Pre-filled with the client’s name", "Blank, for review only", "Signed by you in advance", "Left out"], 1, "Sample contracts stay blank. Clients sign the electronic versions later."],
        ["Before scheduling showings, what should you confirm with the lender?", ["Pre-approval status, conditions, and budget including HOA dues", "The lender’s commission", "The buyer’s favorite color", "Nothing"], 0, "Confirm purchasing power so you don’t show homes outside their range."],
        ["Your buyer plans a large cash down payment. What do you need?", ["Proof of funds", "A gift letter from you", "A second agent", "A seller concession"], 0, "The guide calls for proof of funds for large cash down payments."],
        ["What’s the point of tracking must-haves vs. negotiables?", ["It’s required by the MLS", "It keeps the search focused on what really matters to the buyer", "It sets your commission", "It replaces the pre-approval"], 1, "Detailed notes keep the MLS search and showings on target."]
      ] },
      { id: "showings", title: "Showings and new builds", learn: ["You must attend every showing personally, or arrange for another licensed agent.", "Never give lockbox or access codes to buyers. It can put your license at risk.", "If buyers go to an open house without you, send your business cards for the hosting agent.", "Register your buyer with a builder before any visit. Visiting alone first can cost you the commission.", "Builder contracts aren’t CREC forms. They’re written to protect the builder; reps may be unlicensed; earnest money is often larger and may be non-refundable."], q: [
        ["Your buyer asks for the lockbox code so they can peek on their lunch break. What do you do?", ["Share it this once", "Decline; you or another licensed agent must attend", "Text it and delete it later", "Ask the seller"], 1, "Never give access codes to buyers. Attend or send a licensed agent."],
        ["You can’t make a showing. Who can go in your place?", ["The buyer’s friend", "Your unlicensed assistant", "Another licensed agent", "Nobody can show it"], 2, "Only licensed agents may show homes on your behalf."],
        ["Your buyer wants to tour a new build community this weekend without you. What’s the risk?", ["None", "The builder may exclude you from the commission if they weren’t registered", "The buyer loses their pre-approval", "The builder raises the price"], 1, "Register your buyer before any visit, or you may be excluded."],
        ["Which is true about builder contracts?", ["They’re standard CREC forms", "They’re written by the builder’s legal team to protect the builder", "They always have refundable earnest money", "They can’t be reviewed by agents"], 1, "Builder contracts vary widely and aren’t CREC-approved. Review them before your client signs."],
        ["Your buyer is going to an open house alone. What should they bring?", ["Their pre-approval only", "Your business cards to give the host", "Cash for earnest money", "Nothing"], 1, "The guide says to send them with your business cards for the hosting agent."]
      ] },
      { id: "offers", title: "Writing a strong offer", learn: ["Always call the listing agent first: what does the seller want (dates, rent-back, speed), and are there other offers?", "Levers besides price: stronger earnest money, larger down payment, flexible closing, fewer contingencies, escalation clause with a cap.", "Submit with the offer: CBS, Affiliated Business disclosure, Mold Disclosure Addendum, Wire Fraud Disclosure, lead-based paint if applicable, proof of funds if applicable, pre-approval letter.", "Sellers don’t have to sign your buyer’s disclosures, but you must provide them. Document delivery if someone refuses to sign."], q: [
        ["What’s the first thing to do before writing an offer?", ["Send the offer as fast as possible", "Call the listing agent to learn the seller’s priorities", "Lower the price 5%", "Waive inspection"], 1, "Never blindside the listing agent. Learn what the seller cares about."],
        ["Which offer term signals serious intent without raising the price?", ["A larger earnest money deposit", "A longer inspection period", "More contingencies", "A later closing"], 0, "A stronger earnest deposit gives the seller confidence."],
        ["What must every escalation clause include?", ["A cap", "The buyer’s income", "A waived appraisal", "Your commission"], 0, "An uncapped escalation can push your buyer past what they can afford."],
        ["Which document goes with a financed offer?", ["The buyer’s pre-approval or pre-qualification letter", "Seller’s Property Disclosure", "Listing Sales Information Sheet", "Closing statement"], 0, "Include the pre-approval (and proof of funds if applicable)."],
        ["The seller refuses to sign the buyer-side disclosures. What do you do?", ["Cancel the offer", "Provide them anyway and document delivery in the acknowledgment section", "Forge a signature", "Ignore it"], 1, "Sellers aren’t required to sign them, but you must deliver them and document it."]
      ] },
      { id: "deadlines", title: "Dates and deadlines", learn: ["Dates and deadlines are over 70% of the CBS. There are no standard deadlines. Every deal is different.", "Typical recommendations (days after MEC): seller’s disclosure 1–3, loan application 1–5, title 5–8, inspection objection 5–10, HOA documents 14, ILC/survey 14–18, appraisal 18–21, closing about 30.", "Loan terms: 5–8 days after the application deadline. Loan availability: 5 days before closing.", "Coordinate appraisal and closing dates with the lender, and confirm the buyer’s availability before setting inspection dates.", "Unsure? Ask the Employing Broker."], q: [
        ["What does MEC mean?", ["Mortgage escrow closing", "Mutual execution of contract", "Minimum earnest commitment", "MLS entry complete"], 1, "Deadlines in the guide are counted in days after mutual execution of the contract."],
        ["What’s the guide’s typical inspection objection deadline?", ["1–2 days after MEC", "5–10 days after MEC", "30 days after MEC", "At closing"], 1, "5–10 days after MEC gives the buyer time to inspect."],
        ["Typical appraisal deadline?", ["5 days after MEC", "10 days after MEC", "18–21 days after MEC", "The day of closing"], 2, "18–21 days after MEC, set with the lender."],
        ["The new loan availability deadline is usually set…", ["At MEC", "5 days before closing", "On closing day", "30 days after closing"], 1, "Five days before close gives a clear-to-close buffer."],
        ["Who should you coordinate with before setting appraisal and closing dates?", ["The buyer’s lender", "The HOA", "The county assessor", "Nobody"], 0, "The guide says to coordinate appraisal and closing timeframes with the lender."]
      ] },
      { id: "negotiate", title: "Inspection and appraisal negotiations", learn: ["Always recommend an inspection. Common add-ons: sewer scope, roof, electrical, structural, radon, mold, lead, asbestos, meth, well, septic.", "Buyer options after inspection: request repairs (safety, health, structural), price reduction, closing cost credit, or terminate within the deadline.", "Asking for repairs after agreeing not to can be bad faith and risk earnest money.", "Low appraisal: pay the difference, ask for a price reduction, dispute or re-appraise, or cancel with an appraisal contingency.", "FHA loans can’t be re-appraised through the same lender. Keep your ego out of every negotiation."], q: [
        ["Which inspection items should a buyer’s objection focus on?", ["Every scuff and paint chip", "Significant safety, health, and structural items", "Cosmetic upgrades", "Furniture"], 1, "Focus on what matters. A laundry list weakens the request."],
        ["The seller refuses all repairs, and you’re still within the inspection deadline. What can the buyer do?", ["Nothing", "Terminate and recover earnest money", "Sue the seller", "Close anyway, by law"], 1, "Within the deadline, the buyer can terminate and get earnest money back."],
        ["Your buyer agreed not to request repairs, then wants to ask anyway. What’s the risk?", ["None", "It may be bad faith and put earnest money at risk", "The lender cancels the loan", "The price goes up"], 1, "The guide warns this can be bad faith."],
        ["An FHA appraisal comes in low. Which option is NOT available through the same lender?", ["Pay the difference", "Ask the seller to reduce", "A new appraisal from the same lender", "Cancel under an appraisal contingency"], 2, "FHA loans can’t be re-appraised through the same lender."],
        ["Who should test a well?", ["The agent", "A qualified professional, testing flow, bacteria, and contaminants", "The seller", "Nobody"], 1, "Advise clients to get expert help outside your license; well tests check pump flow, bacteria, and contaminants."]
      ] },
      { id: "close-buyer", title: "Under contract to closed (buyer side)", learn: ["Send the file to the buyer’s lender immediately when you go under contract.", "Send the buyer a congratulatory email with next steps and key dates (earnest money, inspection, insurance with a CLUE report, lender items, inspectors).", "Within 72 hours, submit to your broker: Exclusive Right-to-Buy, the executed CBS, counterproposal if any, and all signed disclosures.", "Review HOA documents and the title commitment carefully. Schedule B-1 lists requirements; B-2 lists exceptions the policy won’t cover.", "After closing, submit the complete file for compliance."], q: [
        ["Your buyer just went under contract. Who gets the file immediately?", ["The buyer’s lender", "The listing agent’s broker", "The HOA", "The county"], 0, "The guide says to send the file to the buyer’s lender right away."],
        ["How soon do the executed documents go to your broker?", ["Within 72 hours", "Within 30 days", "After closing only", "Never"], 0, "Submit within 72 hours of acceptance."],
        ["In the title commitment, where are the exceptions the policy will NOT cover?", ["Schedule A", "Schedule B, Section 1", "Schedule B, Section 2", "The closing statement"], 2, "Schedule B-2 lists exceptions; items 1–8 are standard. Review the rest carefully."],
        ["What should your buyer ask their insurance agent for?", ["A CLUE report on prior claims", "A home warranty", "An appraisal", "A survey"], 0, "A CLUE report shows prior insurance claims on the property."],
        ["Which policy protects the buyer for as long as they own the home?", ["Lender’s title policy", "Owner’s title policy", "Home warranty", "PMI"], 1, "The owner’s title policy (OTP) protects the buyer; the lender’s policy protects the lender."]
      ] }
    ] },
    { id: "seller", title: "The listing side", part: "Part 3", lessons: [
      { id: "listappt", title: "The listing appointment", learn: ["Arrive on time with a CMA, a listing presentation, and your listing packet.", "Packet: seller guide, timeline, showing/inspection/appraisal rules, the CMA, sample marketing, a blank sample Exclusive Right-to-Sell, both disclosures.", "Plus at least three inspectors, house cleaners, handypeople, and carpet cleaners, alphabetical.", "Same rule: Definitions of Working Relationships / Broker Disclosure to Seller and the Affiliated Business disclosure before any confidential discussion.", "Then secure the listing: Exclusive Right-to-Sell, Mold Disclosure, Wire Fraud Disclosure."], q: [
        ["What three things should you bring to every listing appointment?", ["A CMA, a listing presentation, and a listing packet", "A sign, a lockbox, and a camera", "Your license, a contract, and a pen", "Coffee"], 0, "The guide lists the CMA, a professional presentation, and the packet."],
        ["How many recommended carpet cleaners belong in the listing packet?", ["One", "At least three, alphabetical", "None", "Only the cheapest"], 1, "At least three each of inspectors, cleaners, handypeople, and carpet cleaners, alphabetical."],
        ["The seller starts telling you why they must move fast before disclosures are signed. What do you do?", ["Keep going", "Pause and complete the required disclosures first", "Sign the listing first", "Call the broker"], 1, "Disclosures come before any confidential discussion, on the listing side too."],
        ["Which documents secure the listing after disclosures?", ["Exclusive Right-to-Sell, Mold Disclosure, Wire Fraud Disclosure", "CBS and Closing Instructions", "Exclusive Right-to-Buy and radon pamphlet", "Just a handshake"], 0, "Those three secure the listing per the guide."],
        ["What should the sample Exclusive Right-to-Sell in your packet look like?", ["Blank, with no seller names", "Pre-signed", "Filled in from the last seller", "Left out"], 0, "Keep sample contracts blank and use them to walk the seller through it."]
      ] },
      { id: "golive", title: "Walk-through, documents, and marketing", learn: ["Pre-listing walk-through: upgrades (costs, dates, permits), cleaning, depersonalizing (photos, valuables, medications, firearms), staging, showing restrictions.", "Prepare before going live: Seller’s Property Disclosure, Source of Water, Square Footage, Lead-Based Paint if pre-1978, Closing Instructions, plus the disclosures.", "Collect HOA transfer costs and warranty or lease info (solar, appliances) now.", "Marketing: professional HD photos, video and drone where it fits, social and paid ads, open houses, flyers.", "Write a genuine, personal listing description. AI-generated copy is easy to spot and can hurt your credibility."], q: [
        ["During the walk-through, what should the seller secure or remove?", ["Light bulbs", "Photos, valuables, medications, and firearms", "Appliances", "Window coverings"], 1, "Depersonalize and secure anything valuable or sensitive."],
        ["Why collect HOA transfer costs and solar or appliance leases before listing?", ["The MLS requires it", "It prevents delays once an offer is accepted", "It raises the price", "It isn’t needed"], 1, "The guide’s tip: gather it now to avoid delays later."],
        ["Which disclosure must be prepared for a 1965 home?", ["Lead-Based Paint Disclosure", "FIRPTA affidavit", "USDA eligibility", "New build addendum"], 0, "Homes built before 1978 need the lead-based paint disclosure."],
        ["What does the training say about listing descriptions?", ["Use AI copy as is", "Copy the last listing’s remarks", "Write something genuine and specific; AI copy is easily spotted", "Keep it to one sentence"], 2, "Take the time to write something personal and specific."],
        ["What upgrade details should you collect from the seller?", ["Costs, dates, and permit information", "Only paint colors", "Contractor phone numbers only", "Nothing"], 0, "A list with costs, dates, and permits helps buyers and appraisers."]
      ] },
      { id: "reviewoffers", title: "Reviewing offers", learn: ["Review every offer thoroughly, not just the price.", "Section 2, inclusions/exclusions: make sure the buyer didn’t add back items the seller excluded.", "Dates and deadlines: do they fit the seller’s timeline?", "Section 4.2, seller concessions: easy to miss and can change the net a lot.", "Section 15 (HOA) and Section 29 (additional provisions) can hide significant terms."], q: [
        ["Which CBS section holds seller concessions?", ["Section 2", "Section 4.2", "Section 15", "Section 29"], 1, "Section 4.2. It’s easy to miss and can hit net proceeds hard."],
        ["The seller excluded the garage fridge. Where do you check that the buyer didn’t add it back?", ["Section 2, inclusions/exclusions", "Section 29", "Section 15", "The pre-approval"], 0, "Inclusions and exclusions are in Section 2."],
        ["Where do buyers sometimes slip in major changes that are easy to overlook?", ["Section 29, additional provisions", "The signature page", "The MLS printout", "The earnest money receipt"], 0, "Read Section 29 carefully on every offer."],
        ["Which section covers HOA provisions?", ["Section 4.2", "Section 15", "Section 2", "Section 9"], 1, "Section 15 holds HOA-related terms."],
        ["Two offers are $5,000 apart. What else should you compare?", ["Only price", "Financing, dates, concessions, inclusions, and additional provisions", "The buyers’ names", "Which agent you like"], 1, "Net and certainty matter as much as the headline price."]
      ] },
      { id: "sellerneg", title: "Seller negotiations and closing", learn: ["On acceptance, send the contract to title immediately, then send the buyer’s agent the prepared disclosures, Closing Instructions, and any counterproposal.", "Within 72 hours, submit the executed listing file to your broker in PDF.", "Prepare the seller for the inspection report: it documents every imperfection and isn’t an attack.", "Seller options: make repairs, lower the price, give a closing credit, or decline (the buyer may withdraw or terminate). Read every word of the Inspection Resolution.", "Low appraisal: reduce to value, ask the buyer to cover the gap, meet in the middle, dispute it, or let the buyer cancel under a contingency."], q: [
        ["Your seller accepts an offer. What happens immediately?", ["Send the contract to title", "Order a sign rider and wait", "Call the appraiser", "Post on social media first"], 0, "The guide: send the contract to title immediately upon acceptance."],
        ["How should you prepare a seller for the inspection report?", ["Tell them to refuse everything", "Explain it documents every imperfection and isn’t a personal attack", "Skip it", "Have them attend the inspection"], 1, "Taking the emotion out helps them negotiate well."],
        ["The seller declines all repair requests. What can the buyer do?", ["Nothing", "Withdraw the objection or terminate", "Sue", "Force repairs"], 1, "Declining leaves the buyer free to withdraw the objection or terminate within the deadline."],
        ["Why read every word of the Inspection Resolution?", ["Small wording changes can produce very different outcomes", "It’s required by the MLS", "To check spelling", "It isn’t necessary"], 0, "Minor language changes matter a lot here."],
        ["The appraisal is $15,000 low. Which is a seller option?", ["Meet the buyer in the middle", "Raise the price", "Fire the appraiser", "Cancel the buyer’s loan"], 0, "Reduce to value, ask the buyer to cover it, split it, dispute it, or let the buyer cancel."]
      ] }
    ] },
    { id: "clauses", title: "Clauses and special situations", part: "Part 4", lessons: [
      { id: "competitive", title: "Competitive offer clauses", learn: ["Always review clauses with the Employing Broker before using them.", "Appraisal shortfall: the buyer contributes up to a set amount if the appraisal comes in low.", "Escalation: beats competing bona fide offers by an increment, up to a cap, based on net purchase price (price minus concessions). The seller provides the competing offer within one day of MEC.", "Inspection waiver (limited): the buyer can inspect but only object to material safety, health, or structural items (foundation, roof, main sewer).", "Commission adjustment: the buyer’s agent accepts a stated lower rate to boost the seller’s net."], q: [
        ["Before using any of these clauses, who should review it?", ["The buyer’s cousin", "The Employing Broker", "The appraiser", "Nobody"], 1, "The guide says always review with the Employing Broker."],
        ["In the escalation clause, what is ‘net purchase price’?", ["Purchase price minus seller concessions", "Purchase price plus closing costs", "The appraised value", "The list price"], 0, "It’s purchase price minus any seller concession in Section 4.2 or elsewhere."],
        ["When the seller uses an escalation clause, what must they give the buyer?", ["Nothing", "A copy of the highest competing bona fide offer, within one day after MEC", "Their tax return", "A home warranty"], 1, "That’s how the buyer verifies the escalation was triggered properly."],
        ["Under the limited inspection waiver, which items can the buyer still object to?", ["Paint and carpet", "Material safety, health, or structural items, meaning foundation, roof, and main sewer line", "Anything", "Nothing at all"], 1, "Structural is defined narrowly as foundation, roof, and main sewer line."],
        ["What does the appraisal shortfall clause promise?", ["The seller lowers the price", "The buyer contributes up to a set amount toward a low appraisal", "The lender ignores the appraisal", "A second appraisal"], 1, "The buyer agrees to cover up to $[amount] of a shortfall at closing."]
      ] },
      { id: "listingverbiage", title: "Listing agreement verbiage and contract options", learn: ["Personal belongings: advise the seller to secure or remove medications, firearms, jewelry, and valuable or sentimental items.", "Buyer love letters: the seller can decline them; letters received are deleted unread, and it can be noted in the MLS. Letters can reveal protected-class information.", "Recording devices: no listening in on buyers while they consider offers; the seller must post a visible notice if devices may record.", "Optional ILC clause (9.1.2): lender-required ILC, buyer pays; title-required ILC, seller pays.", "Optional due diligence clause (10.6.1.2): ILC, survey, plans, plat, warranties, prior inspections, radon results, only if in the seller’s possession."], q: [
        ["Why do many sellers decline buyer love letters?", ["They take too long to read", "They can reveal protected-class information that shouldn’t affect the decision", "The MLS bans them", "They raise the price"], 1, "It’s a fair housing concern."],
        ["Your seller has a doorbell camera with audio. What does the listing verbiage require?", ["Turn it up", "Don’t use recording to gain an advantage on offers, and post a visible notice that devices may record", "Nothing", "Remove all cameras"], 1, "Devices shouldn’t be used when considering offers, and buyers must be notified in a conspicuous place."],
        ["Under the optional ILC clause, who pays if the lender requires the ILC?", ["The seller", "The buyer", "The title company", "The agent"], 1, "Lender-required: buyer pays. Title-required: seller pays."],
        ["The due diligence documents clause covers items…", ["Only if in the seller’s possession", "The seller must create", "The agent provides", "From the county only"], 0, "It asks for them only if the seller has them."],
        ["What should the seller do with prescription medications before showings?", ["Leave them out", "Secure or remove them", "Label them", "Nothing"], 1, "The personal belongings language covers medications, firearms, jewelry, and valuables."]
      ] },
      { id: "firpta", title: "FIRPTA", learn: ["FIRPTA requires withholding when a foreign person sells U.S. real property.", "Withholding rate: generally 15% of the amount realized.", "The buyer (transferee) is typically the withholding agent, and can be liable if withholding isn’t done.", "Amount realized = cash paid + fair market value of other property + liabilities the buyer assumes.", "Always bring in a tax professional or real estate attorney. This isn’t an area for generalist advice."], q: [
        ["Who is typically the FIRPTA withholding agent?", ["The listing agent", "The buyer (transferee)", "The appraiser", "The HOA"], 1, "The buyer is usually the withholding agent and can be liable."],
        ["What’s the general FIRPTA withholding rate in the guide?", ["5%", "10%", "15% of the amount realized", "21%"], 2, "15% of the amount realized (10% applied before February 17, 2016)."],
        ["The seller may be a foreign person. What should you do?", ["Give tax advice yourself", "Make sure a tax professional or attorney is involved", "Ignore it", "Cancel the deal"], 1, "The guide says to consult a qualified tax professional or real estate attorney."],
        ["Which is part of the ‘amount realized’?", ["Liabilities the buyer assumes", "The agent’s commission", "The appraisal fee", "HOA dues"], 0, "Cash paid, plus fair market value of other property, plus liabilities assumed."],
        ["If FIRPTA withholding is missed, who may be held liable?", ["The buyer", "The MLS", "The inspector", "No one"], 0, "The buyer, as transferee, may be liable for the tax."]
      ] }
    ] },
    { id: "tools", title: "Tools of the trade", part: "Part 5", lessons: [
      { id: "ctm", title: "CTM eContracts", learn: ["An offer that won’t integrate is usually a missing or wrong legal description, often traced back to the listing contract.", "Buyer’s agent: client file → Integrate Sale Offer → choose the contract → follow the prompts.", "Listing agent: client file → Integrate Received Offer → paste the full CBS URL.", "Locked contract with an error? Copy/Duplicate locked contracts to edit a copy without changing the signed original.", "Sync deadlines to Google Calendar from Utilities → Contract Deadlines Email Notification Settings (only Active or Under Contract deals, from two months back)."], q: [
        ["An offer won’t integrate in CTM. What’s the most common cause?", ["A missing or incorrect legal description", "A slow internet connection", "The buyer’s credit", "The MLS is down"], 0, "CTM populates from the Exclusive Right-to-Sell, so an inaccurate legal description breaks integration."],
        ["As the listing agent, what do you paste into Integrate Received Offer?", ["The buyer’s email", "The full CBS URL from the offer", "The MLS number", "The legal description"], 1, "Copy the full URL from the offer into the popup."],
        ["You need to fix a typo in a signed, locked contract. What do you do?", ["Edit the signed original", "Copy/Duplicate the locked contract and edit the copy", "Start a new file", "Ask the buyer to re-sign the original"], 1, "Duplicating keeps the signed original intact."],
        ["Which transactions sync to Google Calendar?", ["All of them, forever", "Active or Under Contract, from two months back", "Closed only", "Withdrawn only"], 1, "Only Active or Under Contract, and only from the past two months forward."],
        ["As the buyer’s agent, which CTM option brings in your offer?", ["Integrate Sale Offer", "Integrate Received Offer", "Copy locked contracts", "Utilities"], 0, "Buyer’s agents use Integrate Sale Offer."]
      ] }
    ] }
  ];
  const LESSONS = STAGES.flatMap(s => s.lessons.map(l => ({ ...l, stage: s.id })));
  const ALLQ = LESSONS.flatMap(l => l.q.map(q => ({ q, lesson: l.id })));
  const PASS = 0.8, TESTN = 20, XP_Q = 10, XP_LESSON = 20, XP_TEST = 100;

  /* ------------------------------ Progress ------------------------------ */
  const blank = () => ({ done: {}, xp: 0, streak: 0, last: "", cert: null });
  const prog = () => ({ ...blank(), ...((Store.crm.training || {}).progress || {}) });
  const save = p => { p.updatedAt = new Date().toISOString(); p.name = ((Store.team || {})[Store.crmOwner] || {}).name || ""; Store.saveCrm("training", "progress", p); };
  const nextLesson = p => LESSONS.find(l => !p.done[l.id]);
  const roadDone = p => LESSONS.every(l => p.done[l.id]);
  function bumpStreak(p) {
    if (p.last === today()) return;
    p.streak = p.last === yesterday() ? (p.streak || 0) + 1 : 1; p.last = today();
  }
  const streakNow = p => (p.last === today() || p.last === yesterday()) ? p.streak || 0 : 0;
  T.counts = () => { const p = prog(); return { left: LESSONS.filter(l => !p.done[l.id]).length, total: LESSONS.length, cert: !!p.cert }; };

  /* ------------------------------ Styles ------------------------------ */
  if (!document.getElementById("trStyles")) {
    const st = document.createElement("style"); st.id = "trStyles";
    st.textContent = `
.tr-stats{display:flex;gap:8px;margin:6px 0 14px}.tr-stat{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.tr-stat b{display:block;font:600 26px/1.1 var(--serif)}.tr-stat span{font-size:12px;color:var(--ink-2)}
.tr-road{position:relative;padding:4px 0 10px}.tr-road:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:10px;margin-left:-5px;background:var(--surface-2);border-radius:6px;background-image:linear-gradient(var(--gold) 50%,transparent 0);background-size:2px 22px;background-repeat:repeat-y;background-position:center}
.tr-sign{position:relative;z-index:1;margin:18px auto 12px;max-width:320px;text-align:center;background:var(--midnight);color:var(--linen);border-radius:10px;padding:10px 14px;border-bottom:3px solid var(--gold)}
.tr-sign small{display:block;color:var(--gold);font-size:11px;letter-spacing:.08em;text-transform:uppercase}.tr-sign strong{font:600 20px/1.2 var(--serif)}
.tr-stop{position:relative;z-index:1;display:flex;align-items:center;gap:12px;width:calc(50% + 34px);margin:10px 0;background:none;border:0;padding:0;text-align:left;color:var(--ink)}
.tr-stop.r{margin-left:calc(50% - 34px)}.tr-stop.l{flex-direction:row-reverse;text-align:right}
.tr-dot{flex:0 0 68px;height:68px;border-radius:50%;display:grid;place-items:center;font:700 22px var(--sans);background:var(--surface);border:3px solid var(--line);color:var(--ink-2);box-shadow:0 4px 0 var(--line)}
.tr-stop.done .tr-dot{background:var(--gold);border-color:var(--gold-strong);color:#fff;box-shadow:0 4px 0 var(--gold-strong)}
.tr-stop.next .tr-dot{background:var(--midnight);border-color:var(--gold);color:var(--gold);box-shadow:0 4px 0 var(--gold);animation:trPulse 1.6s ease-in-out infinite}
.tr-stop.locked{opacity:.55}.tr-stop.locked .tr-dot svg{width:22px;height:22px}
.tr-stop .tr-t{font-weight:600;font-size:15px;line-height:1.25}.tr-stop .tr-t small{display:block;font-weight:400;font-size:12px;color:var(--ink-2)}
@keyframes trPulse{50%{transform:scale(1.06)}}@media (prefers-reduced-motion:reduce){.tr-stop.next .tr-dot{animation:none}}
.tr-closed{position:relative;z-index:1;margin:22px auto 0;max-width:340px;text-align:center;background:var(--surface);border:2px solid var(--gold);border-radius:14px;padding:16px}
.tr-closed h3{font:600 26px/1.1 var(--serif);margin:6px 0}
.tr-bar{height:12px;border-radius:8px;background:var(--surface-2);overflow:hidden;margin:4px 0 16px}.tr-bar i{display:block;height:100%;background:var(--gold);border-radius:8px;transition:width .3s}
.tr-top{display:flex;align-items:center;gap:10px}.tr-top .tr-bar{flex:1;margin:0}.tr-x{background:none;border:0;font-size:24px;line-height:1;color:var(--ink-2);padding:4px 6px}
.tr-q{font:600 22px/1.3 var(--serif);margin:18px 0 14px}
.tr-opt{display:block;width:100%;text-align:left;margin:0 0 10px;padding:14px 16px;border-radius:12px;background:var(--surface);border:2px solid var(--line);box-shadow:0 3px 0 var(--line);color:var(--ink);font-size:15px}
.tr-opt.sel{border-color:var(--gold);box-shadow:0 3px 0 var(--gold-strong)}.tr-opt.right{border-color:var(--love);background:color-mix(in srgb,var(--love) 12%,var(--surface))}.tr-opt.wrong{border-color:var(--pass);background:color-mix(in srgb,var(--pass) 12%,var(--surface))}
.tr-fb{border-radius:12px;padding:14px 16px;margin:6px 0 12px}.tr-fb.ok{background:color-mix(in srgb,var(--love) 14%,var(--surface));border:1px solid var(--love)}.tr-fb.no{background:color-mix(in srgb,var(--pass) 12%,var(--surface));border:1px solid var(--pass)}
.tr-fb strong{display:block;margin-bottom:4px}.tr-learn{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:12px;padding:14px 16px 6px 34px}
.tr-learn li{margin:0 0 10px;line-height:1.45}.tr-big{width:100%;padding:14px;font-size:16px}
.tr-done{text-align:center;padding:10px 0}.tr-done h2{font:600 32px/1.1 var(--serif);margin:10px 0 6px}`;
    document.head.appendChild(st);
  }
  const lock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>`;
  const check = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`;

  /* ------------------------------ Views ------------------------------ */
  T.html = function () {
    if (T.view === "lesson" && T.L && (T.L.phase === "learn" || T.L.queue.length)) return lessonHTML();
    if (T.view === "result" && T.L) return resultHTML();
    return roadHTML();
  };
  function roadHTML() {
    const p = prog(), nx = nextLesson(p), doneN = LESSONS.filter(l => p.done[l.id]).length, all = roadDone(p);
    let n = 0, html = `<p class="addr">Short lessons from The Miller Group Road to Closed Training Guide. Read the key points, answer a few questions, and keep your streak going. Finish the road, then pass the Road test to get certified.</p>
      <div class="tr-stats"><div class="tr-stat"><b>${streakNow(p)}</b><span>Day streak</span></div><div class="tr-stat"><b>${(p.xp || 0).toLocaleString()}</b><span>XP</span></div><div class="tr-stat"><b>${doneN}/${LESSONS.length}</b><span>Lessons</span></div></div>
      <div class="tr-bar" role="progressbar" aria-label="Road progress" aria-valuenow="${doneN}" aria-valuemin="0" aria-valuemax="${LESSONS.length}"><i style="width:${Math.round(doneN / LESSONS.length * 100)}%"></i></div>
      ${nx ? `<button class="btn gold tr-big" data-tr-start="${nx.id}">${doneN ? "Continue" : "Start"}: ${esc(nx.title)}</button>` : ""}
      ${Store.isBroker ? `<div class="quick" style="margin-top:10px"><button class="btn ghost" data-panel="training-team">Team progress</button></div>` : ""}
      <div class="tr-road">`;
    STAGES.forEach(s => {
      html += `<div class="tr-sign"><small>${esc(s.part)}</small><strong>${esc(s.title)}</strong></div>`;
      s.lessons.forEach(l => {
        const done = !!p.done[l.id], next = nx && nx.id === l.id, open = done || next, side = n++ % 2 ? "r" : "l";
        html += `<button class="tr-stop ${side} ${done ? "done" : next ? "next" : "locked"}" ${open ? `data-tr-start="${l.id}"` : "disabled"} aria-label="${esc(l.title)}${done ? ", done" : next ? ", up next" : ", locked"}"><span class="tr-dot">${done ? check : next ? n : lock}</span><span class="tr-t">${esc(l.title)}<small>${done ? `Done · best ${p.done[l.id].best}%` : next ? `Up next · ${l.q.length} questions` : `${l.q.length} questions`}</small></span></button>`;
      });
    });
    html += `<div class="tr-closed"><svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="${p.cert ? "var(--gold)" : "var(--surface-2)"}"/><circle cx="24" cy="32" r="9" fill="none" stroke="var(--midnight)" stroke-width="4"/><path d="M33 32h18M45 32v7M51 32v5" stroke="var(--midnight)" stroke-width="4" stroke-linecap="round"/></svg>
      <h3>${p.cert ? "Closed" : "Road test"}</h3><p class="addr">${p.cert ? `Certified ${new Date(p.cert.at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} with ${p.cert.score}%. Retake it anytime.` : all ? `${TESTN} questions from the whole road. Score ${PASS * 100}% to get certified.` : "Finish every lesson to unlock the Road test."}</p>
      ${all ? `<button class="btn gold tr-big" data-tr-test>${p.cert ? "Retake the Road test" : "Take the Road test"}</button>` : ""}</div></div>
      <p class="addr" style="margin-top:14px">Based on the 2026 guide. Loan limits, assistance programs, and income limits change every year, so verify current figures with a lender before advising clients. Questions about a specific deal go to the Employing Broker.</p>`;
    return html;
  }
  function lessonHTML() {
    const L = T.L, total = L.items.length, pct = Math.round(L.solved / L.target * 100);
    let html = `<div class="tr-top"><button class="tr-x" data-tr-quit aria-label="Quit lesson">×</button><div class="tr-bar" role="progressbar" aria-label="Lesson progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>`;
    if (L.phase === "learn") {
      return html + `<h2 class="tr-q">${esc(L.title)}</h2><p class="addr">Know this</p><ul class="tr-learn">${L.learn.map(x => `<li>${esc(x)}</li>`).join("")}</ul><button class="btn gold tr-big" style="margin-top:14px" data-tr-go>Start questions</button>`;
    }
    const it = L.items[L.queue[0]], [prompt, opts, ans, why] = it.q, order = it.order;
    html += `${L.test ? `<p class="addr">Road test · question ${L.answered + 1} of ${total}</p>` : it.retry ? `<p class="addr">Let’s try this one again</p>` : ""}<h2 class="tr-q">${esc(prompt)}</h2>`;
    html += order.map(i => { let c = ""; if (L.checked) { if (i === ans) c = "right"; else if (i === L.sel) c = "wrong"; } else if (i === L.sel) c = "sel"; return `<button class="tr-opt ${c}" data-tr-opt="${i}" ${L.checked ? "disabled" : ""}>${esc(opts[i])}</button>`; }).join("");
    if (L.checked) { const ok = L.sel === ans; html += `<div class="tr-fb ${ok ? "ok" : "no"}" role="status"><strong>${ok ? ["Nice work.", "That’s right.", "Exactly.", "You got it."][L.answered % 4] : `Not quite. The answer is: ${esc(opts[ans])}`}</strong>${esc(why)}</div><button class="btn gold tr-big" data-tr-next>Continue</button>`; }
    else html += `<button class="btn gold tr-big" data-tr-check ${L.sel == null ? "disabled" : ""}>Check</button>`;
    return html;
  }
  function resultHTML() {
    const L = T.L, acc = Math.round(L.first / L.target * 100);
    if (L.test) {
      const pass = acc >= PASS * 100;
      return `<div class="tr-done"><h2>${pass ? "You’re certified" : "Almost there"}</h2><p class="addr">${acc}% on the Road test${pass ? ` · +${XP_TEST} XP` : `. You need ${PASS * 100}%.`}</p>
        ${L.missed.length ? `<h3 class="agent-h" style="justify-content:center">Review these</h3>` + L.missed.map(m => `<div class="pcard" style="text-align:left"><strong>${esc(m.q[0])}</strong><p>${esc(m.q[1][m.q[2]])}. ${esc(m.q[3])}</p></div>`).join("") : ""}
        <button class="btn gold tr-big" data-tr-road>Back to the road</button>${pass ? "" : `<button class="btn ghost tr-big" style="margin-top:8px" data-tr-test>Try again</button>`}</div>`;
    }
    return `<div class="tr-done"><h2>Lesson complete</h2><p class="addr">${esc(L.title)}</p>
      <div class="tr-stats"><div class="tr-stat"><b>+${L.xp}</b><span>XP</span></div><div class="tr-stat"><b>${acc}%</b><span>First-try accuracy</span></div><div class="tr-stat"><b>${streakNow(prog())}</b><span>Day streak</span></div></div>
      <button class="btn gold tr-big" data-tr-road>Back to the road</button>${nextLesson(prog()) ? `<button class="btn ghost tr-big" style="margin-top:8px" data-tr-start="${nextLesson(prog()).id}">Next lesson</button>` : ""}</div>`;
  }

  /* Broker: team progress. Reads each agent's own progress doc (admins can read agent/*). */
  T.teamHTML = function () {
    const rows = T.team;
    if (!rows) { if (!T.loading) { T.loading = true; setTimeout(loadTeam, 0); } return `<p class="addr">Loading team progress…</p>`; }
    if (!rows.length) return `<div class="empty"><strong>No agents yet</strong>Add agents and they’ll show up here.</div>`;
    return `<p class="addr">Each agent’s lessons, XP, and Road test status.</p>` + rows.map(r => { const d = Object.keys(r.p.done || {}).filter(k => LESSONS.some(l => l.id === k)).length;
      return `<div class="pcard"><div class="pcard-top"><div><strong>${esc(r.name)}</strong><p>${d}/${LESSONS.length} lessons · ${(r.p.xp || 0).toLocaleString()} XP${streakNow(r.p) ? ` · ${streakNow(r.p)}-day streak` : ""}${r.p.updatedAt ? ` · active ${when(r.p.updatedAt)}` : ""}</p></div><span class="addr">${r.p.cert ? `Certified ${r.p.cert.score}%` : d === LESSONS.length ? "Ready for Road test" : "In progress"}</span></div>
        <div class="tr-bar" style="margin:8px 0 2px"><i style="width:${Math.round(d / LESSONS.length * 100)}%"></i></div></div>`; }).join("");
  };
  async function loadTeam() {
    const ids = Object.keys(Store.team || {}), out = [];
    for (const id of ids) {
      let p = null;
      if (id === Store.crmOwner) p = prog();
      else if (Store.demo) p = T.demoTeam[id] || blank();
      else { try { const s = await Store.db.doc(`agent/${id}/crm/training/progress`).get(); p = s.exists ? s.data() : blank(); } catch (e) { p = blank(); } }
      out.push({ id, name: (Store.team[id] || {}).name || "Agent", p });
    }
    T.team = out; T.loading = false; if (agentPanel === "training-team") renderAgent();
  }
  T.demoTeam = {};
  T.seedDemo = function () {
    const d = new Date(); d.setDate(d.getDate() - 1);
    T.demoTeam["demo-agent"] = { done: Object.fromEntries(LESSONS.slice(0, 9).map(l => [l.id, { best: 100 - (l.id.length % 3) * 20, at: d.toISOString() }])), xp: 640, streak: 4, last: d.toLocaleDateString("en-CA"), cert: null, updatedAt: d.toISOString() };
  };

  /* ------------------------------ Flow ------------------------------ */
  function startLesson(id) {
    const l = LESSONS.find(x => x.id === id); if (!l) return;
    const items = l.q.map(q => ({ q, order: shuffle(q[1].map((_, i) => i)) }));
    T.L = { id, title: l.title, learn: l.learn, items, queue: items.map((_, i) => i), target: items.length, solved: 0, first: 0, answered: 0, missedSet: new Set(), sel: null, checked: false, phase: "learn", xp: 0 };
    T.view = "lesson"; go();
  }
  function startTest() {
    const picks = shuffle(ALLQ).slice(0, TESTN).map(x => ({ q: x.q, order: shuffle(x.q[1].map((_, i) => i)) }));
    T.L = { test: true, title: "Road test", items: picks, queue: picks.map((_, i) => i), target: picks.length, solved: 0, first: 0, answered: 0, missed: [], sel: null, checked: false, phase: "q", xp: 0 };
    T.view = "lesson"; go();
  }
  function checkAnswer() {
    const L = T.L, i = L.queue[0], it = L.items[i], ok = L.sel === it.q[2];
    L.checked = true;
    if (L.test) { if (ok) L.first++; else L.missed.push(it); }
    else if (ok) { if (!L.missedSet.has(i)) { L.first++; L.xp += XP_Q; } } else L.missedSet.add(i);
    go();
  }
  function nextQ() {
    const L = T.L, i = L.queue.shift(), it = L.items[i], ok = L.sel === it.q[2];
    L.answered++;
    if (L.test || ok) L.solved++;
    else { it.retry = true; it.order = shuffle(it.order); L.queue.push(i); }   // missed questions come back at the end
    L.sel = null; L.checked = false;
    if (!L.queue.length) finish(); else go();
  }
  function finish() {
    const L = T.L, p = prog(), acc = Math.round(L.first / L.target * 100);
    if (L.test) { if (acc >= PASS * 100) { p.cert = { at: new Date().toISOString(), score: acc }; p.xp = (p.xp || 0) + XP_TEST; } p.lastTest = { at: new Date().toISOString(), score: acc }; }
    else { L.xp += XP_LESSON; p.xp = (p.xp || 0) + L.xp; const prev = p.done[L.id]; p.done = { ...p.done, [L.id]: { best: Math.max(acc, prev ? prev.best : 0), at: new Date().toISOString() } }; }
    bumpStreak(p); T.team = null; T.view = "result";
    save(p); go();
  }
  function go() { if (typeof agentPanel !== "undefined" && agentPanel !== "training") agentPanel = "training"; renderAgent(); window.scrollTo(0, 0); }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-tr-start],[data-tr-test],[data-tr-go],[data-tr-opt],[data-tr-check],[data-tr-next],[data-tr-quit],[data-tr-road]"); if (!b) return; const d = b.dataset;
    if (d.trStart !== undefined) startLesson(d.trStart);
    else if (d.trTest !== undefined) startTest();
    else if (d.trGo !== undefined) { T.L.phase = "q"; go(); }
    else if (d.trOpt !== undefined) { if (!T.L.checked) { T.L.sel = +d.trOpt; renderAgent(); } }
    else if (d.trCheck !== undefined) { if (T.L.sel != null) checkAnswer(); }
    else if (d.trNext !== undefined) nextQ();
    else if (d.trQuit !== undefined || d.trRoad !== undefined) { T.view = "road"; T.L = null; go(); }
  });
  T._t = { STAGES, LESSONS, ALLQ, prog, finish: () => finish(), PASS, TESTN };
  T.seedDemo();
})();
