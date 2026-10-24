# RollBound Debug Log

Hello! I am writing this log to keep track of the bugs I have caught, my reasoning to fix them, and what next steps I took for the project to improve.


## Test Runs

To the suggestion of Claude, we will have a Github action that will run before every push to the main branch that will generate roughly 42,000 test characters to make sure nothing is broken. For each of the 16 classes it builds about 4,400 characters, which takes about 3 seconds:

- every ancestry with each heritage the builder offers,
- every background,
- every subclass option, and for classes with a deity, every deity that fits.

Each character must come out with no builder errors and a complete sheet with real numbers. If something breaks, the test names the combinations, like "Elf / Ancient Elf / Acolyte: …".

These tests did find a bug on the initial run, so already paying off!

## Demo Account

L

## Character Builder

This extensive feature was an initial part of my capstone project and it is crucial that it is not only now optimized for the Pathfinder ruleset, but elevated from just a form. I am elated at how it has turned out, granted it didn't come with some issues to iron out!

For starters, when you made your selections, you could not reset your character from scratch and this was a massive pain point. So we added an option that I believe resets the cache on the client side, but now it works. This is something I want to understand how it works a bit more clearly.

## Character Sheet Export

I thought a super cool feature would be to have the option to dowload your character as a PDF file. So as I explored this and built it out, we ran into some issues with using a non-fillable version of the file where some fields were hidden and things were not lining up in their designated spaces. Thankfully a user in the community created a fillable version and we were able to debug some of the issues we encountered.

Another problem that occured was that when you clicked on the button, you would automatically download the PDF file instead of viewing it first. This makes for a bad experience and the first iteration of this had the user open a separate page and then had to click back into the initial tab where their character lived for the information to fill out.

These were both fixed, and while I try to understand how that works specifically and effeciently, it is a feature I am very happy to have in this project.

## Character Art

So the first thing here is that we wanted to make sure that these files are being referenced in the assets folder compared to in the code itself. After taking a look at the file structure, I noticed this issue and wanted to make sure that this wasn't a pain in the future. That way also, when we add more ancestries and classes, the art will be much easier to add and less dependent on the code.

Additionally, there were several issues with padding and spacing, so I made some adjustments to the image sizes and icon sizes so that everything is in the same format and will serve as a template for future additions, while also making this generally more pleasing to the eye.

## Scalability

I had Claude evaluate some opportunity areas on where the project could improve.

## AWS S3 Buckets