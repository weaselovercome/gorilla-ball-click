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
import { TaskDrawable, TaskDrawableFactory, TaskDrawableComponent,
         component, registerEditor, registerSimple, drawableEditorForm } from "@gorilla/compiled/task-builder.js"

type Position = {
    y: number;
    x: number;
};

// instance variables. interfaces are a typescript thing
export interface BallGameFactory extends TaskDrawableFactory {
    // appearance stuff
    bgColour: string;
    ballColour: string;
    fontSize: number;
    fontFamily: string;
    ballRadius: number; // ball velocity is directly proportional to its radius as per the paper
    fontClickColour: string; // should be orange but I made it editable
    textDuration: number; // amount of time the text is highlighted for
    debug: boolean; // whether to show debug info

    // for rendering
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    scoreY: number;
    scoreColour: string;

    // game variables
    ballPos: Position;
    ballTarget: Position;
    ballVel: Position; // Not a position but it's fine idc
    score: number;
    // test-specific fields
    fidelity: number; // percent of time clicking adds to score. it will still reset the click timer
    clickDelay: number; // time between clicks
    initialDelay: number; // delay before clicking does anything
    inCircle: boolean; // true - clicking circle increases score, false - click on background
    // timers
    initialTimer: number;
    clickTimer: number; // time between clicks
    textTimer: number; // time before text returns to black
    lastFrame: number; // timestamp of previous frame
}

@component(TaskDrawableComponent) // not 100% sure what this line does but it's necessary. the @ sign is also necessary??
export class BallGame extends TaskDrawable<BallGameFactory> {

    public apply(f: BallGameFactory) {
        super.apply(f);
    }

    public screenStart() {
        let canvas = this.factory.canvas;
        canvas.width = this.drawableFrame[0].clientWidth;
        canvas.height = this.drawableFrame[0].clientHeight
        
        // score placed 10px above bottom of screen
        this.factory.scoreY = canvas.height - Number(this.factory.fontSize)/2;

        // initialize game variables
        this.factory.score = 0;
        this.factory.ballPos = { x: canvas.width/2, y: canvas.height/2 };
        this.factory.ballVel = { x: 0, y: 0 };
        this.factory.ballTarget = this.factory.ballPos; // this forces it to be re-chosen and sets the velocity
        // timers
        this.factory.initialTimer = Number(this.factory.initialDelay);
        this.factory.clickTimer = 0;
        this.factory.textTimer = 0;

        this.factory.lastFrame = Date.now(); // update time right before game starts
    }

    public initialise() {
        super.initialise(); // possibly unnecessary

        // create canvas
        let canvas = document.createElement("canvas");
        canvas.style.backgroundColor = this.factory.bgColour;
        this.drawableFrame.append(canvas);
        let ctx = canvas.getContext("2d");

        // add event listener
        canvas.addEventListener("click", (e) => {
            let click = { x: e.offsetX, y: e.offsetY };
            let c = this.calculateDistance(click, this.factory.ballPos) <= this.factory.ballRadius;
            let b = this.factory.inCircle;

            // clicked circle and meant to, or didnt and wasnt meant to AND initial timer over
            if ( (c && b) || !(c || b) && this.factory.initialTimer <= 0 && this.factory.clickTimer <= 0) {
                    this.factory.clickTimer = this.factory.clickDelay;

                    // fidelity check
                    if (Math.random() * 100 > this.factory.fidelity)
                        return;

                    this.factory.score++;
                    this.factory.textTimer = this.factory.textDuration;
            }
        });

        // save globally
        this.factory.canvas = canvas;
        this.factory.ctx = ctx;
    }

    // updates every frame
    public screenUpdate() {
        // draw static frame if not playing
        if(!this.runtimeModeOrEditorPlaying) {
            this.drawFrame(this.factory.ctx, this.factory.canvas);
            return;
        }

        // figure out time between frames in ms
        let time = Date.now();
        let dt = time - this.factory.lastFrame;
        if (!dt) {
            console.log("error calculating dt");
            dt = 0;
        }

        // decrement timers
        this.factory.textTimer--; // in frames
        this.factory.initialTimer -= dt / 1000; // in seconds
        this.factory.clickTimer -= dt / 1000;

        // choose new target if target is touching the ball. loop in case new target is also within the ball
        let d = this.calculateDistance(this.factory.ballTarget, this.factory.ballPos);

        if (d < this.factory.ballRadius) {
            let dx:number, dy:number, d1:number, count = 0;

            do {
                // choose new position
                this.factory.ballTarget = this.getRandomPosition();

                dx = this.factory.ballTarget.x - this.factory.ballPos.x;
                dy = this.factory.ballTarget.y - this.factory.ballPos.y;
                d1 = Math.sqrt(dx ** 2 + dy ** 2);

                count++;
            } while (d < this.factory.ballRadius && count < 10)

            // normalize dx and dy and set velocity to that
            this.factory.ballVel = { x: dx / d1, y: dy / d1 };
        }

        // move ball based on velocity and ball radius
        if (dt > 0 && dt < 1000) { // so the ball doesn't move off the screen during intense lag
            console.log(dt);
            this.factory.ballPos = {
                x: this.factory.ballPos.x + this.factory.ballRadius * this.factory.ballVel.x * dt / 500,
                y: this.factory.ballPos.y + this.factory.ballRadius * this.factory.ballVel.y * dt / 500 };
        }
        
        this.drawFrame(this.factory.ctx, this.factory.canvas);

        this.factory.lastFrame = time;
    }

    private drawFrame(ctx:any, canvas:any) {
        // clear frame
        ctx.beginPath();
        ctx.fillStyle = this.factory.bgColour;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.closePath();

        // draw ball
        let pos = this.factory.ballPos;
        ctx.beginPath();
        ctx.fillStyle = this.factory.ballColour;
        ctx.arc(pos.x, pos.y, this.factory.ballRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();

        // draw score
        ctx.fillStyle = this.factory.textTimer > 0 ? this.factory.fontClickColour : "black";
        ctx.font = `${this.factory.fontSize}px ${this.factory.fontFamily}`;
        ctx.fillText(`Score: ${this.factory.score}`, 10, this.factory.scoreY);

        if (!this.factory.debug) return;

        ctx.fillStyle = "black";
        ctx.fillText(`pos x: ${Math.round(this.factory.ballPos.x)}`, 250, this.factory.scoreY-80);
        ctx.fillText(`pos y: ${Math.round(this.factory.ballPos.y)}`, 250, this.factory.scoreY);
        ctx.fillText(`target x: ${Math.round(this.factory.ballTarget.x)}`, 500, this.factory.scoreY-80);
        ctx.fillText(`target y: ${Math.round(this.factory.ballTarget.y)}`, 500, this.factory.scoreY);
        ctx.fillText(`vx: ${this.factory.ballVel.x}`, 850, this.factory.scoreY-80);
        ctx.fillText(`vy: ${this.factory.ballVel.y}`, 850, this.factory.scoreY);
        ctx.fillText(`fidelity: ${this.factory.fidelity}`, 10, this.factory.fontSize);
        ctx.fillText(`click delay: ${this.factory.clickDelay}s`, 500, this.factory.fontSize);
        ctx.fillText(`initial delay: ${this.factory.initialDelay}s`, 500, Number(this.factory.fontSize) + 80);
        let c = this.factory.inCircle ? "circle" : "background";
        ctx.fillText(`click ${c}`, 10, Number(this.factory.fontSize) + 80);

    }

    // returns a random position anywhere on the screen
    // TODO: make it account for the ball's radius, score text and the ball's current position
    private getRandomPosition(): Position {
        let r = this.factory.ballRadius;
        let d = r
        let mX = this.factory.canvas.width;
        let mY = this.factory.canvas.height;
        return { x: Math.floor(Math.random() * (mX - d) + r), y: Math.floor(Math.random() * (mY - d) + r) };
    }

    private calculateDistance(p1:Position, p2:Position): number {
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        return Math.sqrt(dx ** 2 + dy ** 2);
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
            },
            {
                class: "FormElementText",
                field: "ballRadius",
                label: "Ball Radius"
            },
            {
                class: "FormElementText",
                field: "fontSize",
                label: "Font Size"
            },
            {
                class: "FormElementText",
                field: "fontFamily",
                label: "Font Family"
            },
            {
                class: "FormElementColor",
                field: "fontClickColour",
                label: "Font Colour on Click"
            },
            {
                class: "FormElementText",
                field: "textDuration",
                label: "Text Highlight Duration (frames)"
            },
            {
                class: "FormElementToggle",
                field: "debug",
                label: "Show Debug Info"
            },
            {
                class: "FormElementText",
                field: "fidelity",
                label: "Fidelity (0-100)"
            },
            {
                class: "FormElementText",
                field: "clickDelay",
                label: "Time Between Clicks (s)"
            },
            {
                class: "FormElementText",
                field: "initialDelay",
                label: "Initial Delay Before Clicks (s)"
            },
            {
                class: "FormElementToggle",
                field: "inCircle",
                label: "Clicking Within Circle (off for outside)"
            },
        ].concat(drawableEditorForm()) // add position and size
    }
})

// registers the component itself to be added to objects
registerSimple("component", "BallGame", {
    description: "Ball click task",
})