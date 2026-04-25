//------------------------------------------------------------------------------
// BallGame
//
// This code is largely based on the Hello World example from the documentation
// and the Social Media example, particularly for the boilerplate stuff.
// 
// This seems to be using TypeScript as well as JQuery and possibly React? I know TS but
// nothing else so I'm just kinda guessing at a lot of this
//
//------------------------------------------------------------------------------
import { TaskDrawable, TaskDrawableFactory, TaskDrawableComponent, component, registerEditor, registerSimple, renderHTML, drawableEditorForm } from "@gorilla/compiled/task-builder.js"

// instance variables. unclear why it has to be an interface
export interface BallGameFactory extends TaskDrawableFactory {
    bgColour: string;
    ballColour: string;
}

@component(TaskDrawableComponent) // not 100% sure what this line does but it's necessary. the @ sign is also necessary??
export class BallGame extends TaskDrawable<BallGameFactory> {

    public apply(f: BallGameFactory) {
        super.apply(f);
    }

    public screenStart() {
        if(this.runtimeModeOrEditorPlaying) {
            console.log("a");
        }
    }

    public initialise() {
        super.initialise();
        renderHTML(this.frame, `
        <div style="background-color: {{bgColour}}; height: 100%; width: 100%">
            
        </div>
        `, {bgColour: this.factory.bgColour});
    }
}

// registers the fields so they can be modified in the editor
registerEditor("BallGame", {
    label: "BallGame",
    icon: "fa-solid fa-circle", // fontawesome class
    form: {
        elements: [
            // class - type of input shown in the editor
            // field - the variable, defined in the factory, that this changes
            // label - label shown in editor, doesn't have to be same as field but ideally should be similar
            // conditions (array) - I believe makes it only visible if another field meets some criteria
            {
                class: "FormElementColor",
                field: "bgColour",
                label: "Background Colour",
            },
            {
                class: "FormElementColor",
                field: "ballColour",
                label: "Ball Colour"
            }
        ].concat(drawableEditorForm()) // add position and size
    }
})

// registers the component itself to be added to objects
registerSimple("component", "BallGame", {
    description: "Ball click task",
})