# Frontend Coding Prompt: Alignment Chart Game

Build a mobile-first daily social game where players place friends on alignment charts. Think Wordle meets Wavelength.

## Design System

**Colors:**
- Surface: `#f4f4f6`
- Secondary (inactive): `#66666e`
- Black: `#000000`
- Splash/Brand (CTAs, highlights): `#F9874E`
- Accent (rare emphasis): `#627EF8`

**Typography:**
- Display/Headings: Outfit (SemiBold 600, Bold 700)
- Body/UI: DM Sans (Regular 400, Medium 500)
- Body text minimum 16px for mobile readability

**Spacing:** 4/8/16/24/32px scale
**Border Radius:** 12px (small), 16px (medium), 24px (large)

## Critical: Reactive Gamefeel

Every interaction needs **snap and bounce**:
- **Animations:** Use `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring effect (150-250ms)
- **On Press:** `scale(0.98)` for tactile mobile feedback
- **On Hover:** `translateY(-4px)` with enhanced shadow
- **Staggered reveals:** 100ms delay increments for card appearances

## Mobile-First Requirements

- Touch targets minimum 44×44px
- Primary actions in bottom 60% of screen
- Generous padding on all interactive elements
- Clean, uncluttered layouts with clear visual hierarchy

## Vibe

Friendly and modern. References: NYT Letterboxd game, SoundCloud. Warm orange energy balanced with clean minimalism. Playful without being childish.

# Usability heuristics
Generally applicable design principles. Override when they clash with specific project directives.

# Nielsen's 10 Usability Heuristics

## 1. Visibility of System Status

The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time.

When users know the current system status, they learn the outcome of their prior interactions and determine next steps. Predictable interactions create trust in the product as well as the brand.

**Example:** "You Are Here" indicators on mall maps show people where they currently are, to help them understand where to go next.

**Tips:**
- Communicate clearly to users what the system's state is — no action with consequences to users should be taken without informing them
- Present feedback to the user as quickly as possible (ideally, immediately)
- Build trust through open and continuous communication

## 2. Match Between the System and the Real World

The design should speak the users' language. Use words, phrases, and concepts familiar to the user, rather than internal jargon. Follow real-world conventions, making information appear in a natural and logical order.

The way you should design depends very much on your specific users. Terms, concepts, icons, and images that seem perfectly clear to you and your colleagues may be unfamiliar or confusing to your users.

When a design's controls follow real-world conventions and correspond to desired outcomes (called natural mapping), it's easier for users to learn and remember how the interface works. This helps to build an experience that feels intuitive.

**Example:** When stovetop controls match the layout of heating elements, users can quickly understand which control maps to which heating element.

**Tips:**
- Ensure that users can understand meaning without having to go look up a word's definition
- Never assume your understanding of words or concepts will match that of your users
- User research will uncover your users' familiar terminology, as well as their mental models around important concepts

## 3. User Control and Freedom

Users often perform actions by mistake. They need a clearly marked "emergency exit" to leave the unwanted action without having to go through an extended process.

When it's easy for people to back out of a process or undo an action, it fosters a sense of freedom and confidence. Exits allow users to remain in control of the system and avoid getting stuck and feeling frustrated.

**Example:** Digital spaces need quick emergency exits, just like physical spaces do.

**Tips:**
- Support Undo and Redo
- Show a clear way to exit the current interaction, like a Cancel button
- Make sure the exit is clearly labeled and discoverable

## 4. Consistency and Standards

Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform and industry conventions.

Jakob's Law states that people spend most of their time using digital products other than yours. Users' experiences with those other products set their expectations. Failing to maintain consistency may increase the users' cognitive load by forcing them to learn something new.

**Example:** Check-in counters are usually located at the front of hotels. This consistency meets customers' expectations.

**Tips:**
- Improve learnability by maintaining both types of consistency: internal and external
- Maintain consistency within a single product or a family of products (internal consistency)
- Follow established industry conventions (external consistency)

## 5. Error Prevention

Good error messages are important, but the best designs carefully prevent problems from occurring in the first place. Either eliminate error-prone conditions, or check for them and present users with a confirmation option before they commit to the action.

There are two types of errors: slips and mistakes. Slips are unconscious errors caused by inattention. Mistakes are conscious errors based on a mismatch between the user's mental model and the design.

**Example:** Guard rails on curvy mountain roads prevent drivers from falling off cliffs.

**Tips:**
- Prioritize your effort: Prevent high-cost errors first, then little frustrations
- Avoid slips by providing helpful constraints and good defaults
- Prevent mistakes by removing memory burdens, supporting undo, and warning your users

## 6. Recognition Rather than Recall

Minimize the user's memory load by making elements, actions, and options visible. The user should not have to remember information from one part of the interface to another. Information required to use the design (e.g. field labels or menu items) should be visible or easily retrievable when needed.

Humans have limited short-term memories. Interfaces that promote recognition reduce the amount of cognitive effort required from users.

**Example:** It's easier for most people to recognize the capitals of countries, instead of having to remember them. People are more likely to correctly answer the question "Is Lisbon the capital of Portugal?" rather than "What's the capital of Portugal?"

**Tips:**
- Let people recognize information in the interface, rather than forcing them to remember ("recall") it
- Offer help in context, instead of giving users a long tutorial to memorize
- Reduce the information that users have to remember

## 7. Flexibility and Efficiency of Use

Shortcuts — hidden from novice users — may speed up the interaction for the expert user so that the design can cater to both inexperienced and experienced users. Allow users to tailor frequent actions.

Flexible processes can be carried out in different ways, so that people can pick whichever method works for them.

**Example:** Regular routes are listed on maps, but locals with knowledge of the area can take shortcuts.

**Tips:**
- Provide accelerators like keyboard shortcuts and touch gestures
- Provide personalization by tailoring content and functionality for individual users
- Allow for customization, so users can make selections about how they want the product to work

## 8. Aesthetic and Minimalist Design

Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of information in an interface competes with the relevant units of information and diminishes their relative visibility.

This heuristic doesn't mean you have to use a flat design — it's about making sure you're keeping the content and visual design focused on the essentials. Ensure that the visual elements of the interface support the user's primary goals.

**Example:** An ornate teapot may have excessive decorative elements, like an uncomfortable handle or hard-to-wash nozzle, that can interfere with usability.

**Tips:**
- Keep the content and visual design of UI focused on the essentials
- Don't let unnecessary elements distract users from the information they really need
- Prioritize the content and features to support primary goals

## 9. Help Users Recognize, Diagnose, and Recover from Errors

Error messages should be expressed in plain language (no error codes), precisely indicate the problem, and constructively suggest a solution.

These error messages should also be presented with visual treatments that will help users notice and recognize them.

**Example:** Wrong way signs on the road remind drivers that they are heading in the wrong direction and ask them to stop.

**Tips:**
- Use traditional error-message visuals, like bold, red text
- Tell users what went wrong in language they will understand — avoid technical jargon
- Offer users a solution, like a shortcut that can solve the error immediately

## 10. Help and Documentation

It's best if the system doesn't need any additional explanation. However, it may be necessary to provide documentation to help users understand how to complete their tasks.

Help and documentation content should be easy to search and focused on the user's task. Keep it concise, and list concrete steps that need to be carried out.

**Example:** Information kiosks at airports are easily recognizable and solve customers' problems in context and immediately.

**Tips:**
- Ensure that the help documentation is easy to search
- Whenever possible, present the documentation in context right at the moment that the user requires it
- List concrete steps to be carried out