# Sprint 0 


## Product Vision 

Our vision statement can be found [here](vision.md).

## Invented Customer / Stakeholder Context

Our invented customer is Beluga Press, an online writing community of about 2,000 hobby writers and the readers who follow them. Beluga Press's site was built for stories read from the first chapter to the last, but a growing number of its members write stories where the reader makes the choices. The site has no way to express a choice, so these authors work around it. They post every path as its own chapter and end each one with instructions such as "If you open the door, go to chapter 12." This workaround causes problems for everyone involved:

**Authors** have to keep every instruction correct by hand. Adding, removing, or reordering a single chapter can break the story.

**Readers** have to find their own way to the right chapter. Nothing stops them from opening a chapter they were never meant to see, and the story cannot remember what they chose earlier.

**The organizers of Beluga Press** watch these authors leave for standalone story builders. Those tools are designed for branching stories and handle the links between choices automatically, but they separate authors from the community that already reads their work.

Beluga Press has asked us to build a home for these stories, where a story with choices is as easy to write, publish, and find as an ordinary one, and where its authors and readers stay in one community. 

## Initial Non-Functional Expectations

These are our starting expectations for how well The Story Machine should work. We expect to refine them and to test some of them in later sprints.

| Quality | Expectation | Why it matters for our product |
| --- | --- | --- |
| Performance | After a reader makes a choice, the next part of the story should appear within 1 to 2 seconds. | Readers can move between story branches frequently, so delays should be kept to a minimum to ensure our users do not have a frustrating reading experience. |
| Reliability | An author's saved work and a reader's saved place are never lost. | Our application stores content and progress that our users expect to be available when they return. |
| Reliability | If an image or audio file fails to load, readers should still be able to continue and complete the story. | Presentation only supports the story, so the story content should remain avaialble even when supporting media can't be loaded. |
| Security | Only a story's author can change the story, its settings, or its uploaded files. | Authors must be able to trust that their work stays theirs. Any content should be protected from unauthorized changes. |
| Security | Uploaded files are checked for their real type and size before they are accepted. | File uploads can be one of the main entry points for malicious content. |
| Accessibility | Readers should remain in control of audio playback and always have the option to mute sounds. | Our application should be usable for readers with different devices, preferences and accessibility needs. |


## Technology Stack
These are our starting choices and we expect to revisit them as we build The Story Machine.

| Part | Choice | Why it suits our project |
| --- | --- | --- |
| Client | Angular | Angular's component based architecture will help with keeping our project organized and make it easier to reuse code across our application. Its consistent structure also makes it easier for the group to understand and review each other's work.|
| Server | NestJS | NestJS uses a structure that's similar to Angular, which will help us keep the project consistent and make it easier for group members to work across both the frontend and backend. Since the front and backend use TypeScript, code can be shared instead of having to be rewritten. NestJS also has support for automatic API documentation generation, which will be helpful in future sprints.|
| Database | MongoDB | MongoDB's document based structure fits naturally with the way stories will be organized in our application. Data such as chapters, scenes, dialogue and choices can be stored together in a single document, making the data model easier to work with. Its flexible schema will also let us refine the story format as the project grows without requiring major database changes. |
| Story editor | CodeMirror | CodeMirror will provide us with a reliable editing experience, so we can focus on developing our storytelling features rather than building a text editor from scratch. It is highly customizable, making it a good foundation for supporting our custom story scripting language while remaining easy to extend as the editor evolves.|
| Hosting | Microsoft Azure | Microsoft Azure will host our application and store our uploaded media assets, so we do not have to manage our own server infrastructure. |

### Tradeoffs we accepted

**1. MongoDB doesn't enforce relationships between records.** 

Some features that we have, such as comments, booksmarks, and follows, create relationships between users and stories. A relational database would enforce these relationships automatically. We chose MongoDB because its document based structure is a better fit for storing story content, and we are aware of the responsibility of maintaining those relationships within our application.

**2. Angular and NestJS take longer to learn than other options.** 

Most of our group members have little or no prior experience with Angular. Based on our research online, Angular can take longer to learn initially than frameworks such as React because of its larger feature set and stronger architectural conventions. We accepted this tradeoff because those conventions will give us a consistent structure across the project. In turn, this will hopefully make it easier to understand, review and maintain each other's code as our application grows.

## High-Level Architecture Sketch

![Architecture Diagram](/docs/sprint-0/architecture-diagram.png)

## Documentation
- [GitHub Project Board](https://github.com/users/laradeleon/projects/1) (Contains our planned features and user stories as GitHub issues, including acceptance criteria)
- [Team Working Agreement](team-working-agreement.pdf)
- Git Branching Strategy: [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)