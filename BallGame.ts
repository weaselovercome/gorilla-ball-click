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
import { TaskDrawable, TaskDrawableFactory, TaskDrawableComponent, ResponseType,
         component, registerEditor, registerSimple, drawableEditorForm, } from "@gorilla/compiled/task-builder.js"

type Position = {
    y: number;
    x: number;
};

// interface for editable fields
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

    score: number; // score has to be persistent, so it's in the factory

    // test-specific fields
    clickDelay: number; // time between clicks
    initialDelay: number; // delay before clicking does anything
    fidelity: string; // percent of time clicking adds to score. it will still reset the click timer
    inCircle: string; // true - clicking circle increases score, false - click on background
    resettingDRO: string; // whether clicking the ball before the timer is up resets it or not
    resetScore: string; // whether to set score to zero (for beginning and midpoint)

    mouseHoldLimit: number; // how long mouse can be held still before it gets recorded
}

@component(TaskDrawableComponent) // not 100% sure what this line does but it's necessary. the @ sign is also necessary??
export class BallGame extends TaskDrawable<BallGameFactory> {
    // instance variables
    private ballPos: Position;
    private ballTarget: Position;
    private ballVel: Position;
    // timers
    private initialTimer: number;
    private clickTimer: number; // time between clicks
    private textTimer: number; // time before text returns to black
    private lastFrame: number; // timestamp of previous frame
    private mouseTimer: number; // time since last mouse movement
    // rendering
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private scoreY: number;

    public apply(f: BallGameFactory) {
        super.apply(f);
    }

    public screenStart() {
        let canvas = this.canvas;
        canvas.width = this.drawableFrame[0].clientWidth;
        canvas.height = this.drawableFrame[0].clientHeight
        
        // score placed 10px above bottom of screen
        this.scoreY = canvas.height - Number(this.factory.fontSize)/2;

        // reset score if necessary
        if (this.injectBindings(this.factory.resetScore) == "true" || this.factory.score == undefined)
            this.factory.score = 0;

        // initialize game variables
        this.ballPos = { x: canvas.width/2, y: canvas.height/2 };
        this.ballVel = { x: 0, y: 0 };
        this.ballTarget = this.ballPos; // this forces it to be re-chosen and sets the velocity
        // timers
        this.initialTimer = Number(this.factory.initialDelay);
        this.clickTimer = this.factory.clickDelay;
        this.textTimer = 0;
        this.mouseTimer = 0;

        this.lastFrame = Date.now(); // update time right before game starts
    }

    public initialise() {
        super.initialise(); // possibly unnecessary

        // create canvas
        let canvas = document.createElement("canvas");
        canvas.style.backgroundColor = this.factory.bgColour;
        this.drawableFrame.append(canvas);
        let ctx = canvas.getContext("2d");

        // respond to click
        canvas.addEventListener("click", (e) => {
            let click = { x: e.offsetX, y: e.offsetY };
            let c = this.calculateDistance(click, this.ballPos) <= this.factory.ballRadius;
            let b = this.injectBindings(this.factory.inCircle) == "ball";
            let r = false; // whether or not the click gets reinforced. only true in baseline

            // check for target clicked
            if ( (c && b) || !(c || b) ) {
                // reset timer if doing DRO, otherwise (baseline) add point and reset timer when appropriate
                if (this.injectBindings(this.factory.resettingDRO) == "true") {
                    this.clickTimer = this.factory.clickDelay;
                } else if (this.initialTimer <= 0 && this.clickTimer <= 0) {
                    r = true;
                    this.clickTimer = this.factory.clickDelay;
                    this.factory.score++;
                    this.textTimer = this.factory.textDuration;
                }
            }
            // record response
            this.triggerResponse({
                responseType: ResponseType.Action,
                response: `${c ? "circle" : "background"} clicked`,
                onsetTime: this.screenManager.elapsedTime,
                tag: r ? "reinforced" : "not reinforced"
            });
        });
        // mouse movement resets timer
        canvas.addEventListener("mousemove", () => this.resetMouseTimer());

        // save globally
        this.canvas = canvas;
        this.ctx = ctx;
    }

    // updates every frame
    public screenUpdate() {
        // draw static frame if not playing
        if(!this.runtimeModeOrEditorPlaying) {
            this.drawFrame(this.ctx, this.canvas);
            return;
        }

        // figure out time between frames in ms
        let time = Date.now();
        let dt = time - this.lastFrame;
        if (!dt) {
            console.log("error calculating dt");
            dt = 0;
        }

        // update timers
        this.textTimer--; // in frames
        this.initialTimer -= dt / 1000; // in seconds
        this.clickTimer -= dt / 1000;
        this.mouseTimer += dt / 1000; // in seconds, increasing

        // if doing DRO, give points and reset counter once it reaches zero
        if (this.injectBindings(this.factory.resettingDRO) == "true" && this.clickTimer < 0) {
            // increase score, accounting for fidelity
            if (Math.random() * 100 <= Number(this.injectBindings(this.factory.fidelity))) {
                // update score, make text orange and record response
                this.factory.score++;
                this.textTimer = this.factory.textDuration;
                this.triggerResponse({
                    responseType: ResponseType.Info,
                    response: "score increased",
                    onsetTime: this.screenManager.elapsedTime
            });
            }

            this.clickTimer = this.factory.clickDelay;
        }

        // choose new target if target is touching the ball. loop in case new target is also within the ball
        let d = this.calculateDistance(this.ballTarget, this.ballPos);

        if (d < this.factory.ballRadius) {
            let dx:number, dy:number, d1:number, count = 0;

            do {
                // choose new position
                this.ballTarget = this.getRandomPosition();

                dx = this.ballTarget.x - this.ballPos.x;
                dy = this.ballTarget.y - this.ballPos.y;
                d1 = Math.sqrt(dx ** 2 + dy ** 2);

                count++;
            } while (d < this.factory.ballRadius && count < 10)

            // normalize dx and dy and set velocity to that
            this.ballVel = { x: dx / d1, y: dy / d1 };
        }

        // if time between frames is over a second, it's likely the user tabbed out, so record that
        if (dt >= 1000) {
            this.triggerResponse({
                responseType: ResponseType.Action,
                response: `froze for ${Math.round(dt / 100) / 10}s`,
                onsetTime: this.screenManager.elapsedTime,
                tag: "freeze"
            });
        } else if (dt > 0) { // move ball based on velocity and ball radius
            this.ballPos = {
                x: this.ballPos.x + this.factory.ballRadius * this.ballVel.x * dt / 500,
                y: this.ballPos.y + this.factory.ballRadius * this.ballVel.y * dt / 500 };
        }
        
        this.drawFrame(this.ctx, this.canvas);

        this.lastFrame = time;
    }

    // pretty much just trigger response if necessary
    public screenFinish() {
        this.resetMouseTimer();
    }

    private drawFrame(ctx:any, canvas:any) {
        // clear frame
        ctx.beginPath();
        ctx.fillStyle = this.factory.bgColour;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.closePath();

        // draw ball
        let pos = this.ballPos;
        ctx.beginPath();
        ctx.fillStyle = this.factory.ballColour;
        ctx.arc(pos.x, pos.y, this.factory.ballRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();

        // draw score
        ctx.fillStyle = this.textTimer > 0 ? this.factory.fontClickColour : "black";
        ctx.font = `${this.factory.fontSize}px ${this.factory.fontFamily}`;
        ctx.fillText(`Score: ${this.factory.score}`, 10, this.scoreY);

        if (!this.factory.debug) return;

        ctx.fillStyle = "black";
        ctx.fillText(`pos x: ${Math.round(this.ballPos.x)}`, 250, this.scoreY-80);
        ctx.fillText(`pos y: ${Math.round(this.ballPos.y)}`, 250, this.scoreY);
        ctx.fillText(`target x: ${Math.round(this.ballTarget.x)}`, 500, this.scoreY-80);
        ctx.fillText(`target y: ${Math.round(this.ballTarget.y)}`, 500, this.scoreY);
        ctx.fillText(`vx: ${this.ballVel.x}`, 850, this.scoreY-80);
        ctx.fillText(`vy: ${this.ballVel.y}`, 850, this.scoreY);
        ctx.fillText(`fidelity: ${this.injectBindings(this.factory.fidelity)}%`, 10, this.factory.fontSize);
        ctx.fillText(`click delay: ${this.factory.clickDelay}s`, 500, this.factory.fontSize);
        ctx.fillText(`initial delay: ${this.factory.initialDelay}s`, 500, Number(this.factory.fontSize) + 80);
        ctx.fillText(`click ${this.injectBindings(this.factory.inCircle)}`, 10, Number(this.factory.fontSize) + 80);
        ctx.fillText(`click timer: ${Math.round(this.clickTimer*10)/10}`, 10, Number(this.factory.fontSize) + 160);
        ctx.fillText(`mouse timer: ${Math.round(this.mouseTimer*10)/10}`, 10, Number(this.factory.fontSize) + 240);
        if (this.injectBindings(this.factory.resettingDRO) == "true")
            ctx.fillText(`resetting`, 500, Number(this.factory.fontSize) + 160);
        if (this.injectBindings(this.factory.resetScore) == "true")
            ctx.fillText(`reset score`, 850, Number(this.factory.fontSize) + 160);

    }

    // returns a random position anywhere on the screen
    // TODO: make it account for the ball's radius, score text and the ball's current position
    private getRandomPosition(): Position {
        let r = this.factory.ballRadius;
        let d = r
        let mX = this.canvas.width;
        let mY = this.canvas.height;
        return { x: Math.floor(Math.random() * (mX - d) + r), y: Math.floor(Math.random() * (mY - d) + r) };
    }

    private calculateDistance(p1:Position, p2:Position): number {
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        return Math.sqrt(dx ** 2 + dy ** 2);
    }

    // reset mouse timer and record response if mouse was held for a while
    private resetMouseTimer() {
        if (this.mouseTimer >= this.factory.mouseHoldLimit) {
            this.triggerResponse({
                responseType: ResponseType.Action,
                response: `mouse stopped for ${Math.round(this.mouseTimer * 10) / 10} seconds`,
                // onsetTime is when the mouse stopped moving
                onsetTime: this.screenManager.elapsedTime - (this.mouseTimer * 1000), // convert back to milliseconds
                tag: "mouseHold"
            });
        }
        this.mouseTimer = 0;
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
                field: "clickDelay",
                label: "Time Between Clicks (s)"
            },
            {
                class: "FormElementText",
                field: "initialDelay",
                label: "Initial Delay Before Clicks (s)"
            },
            {
                class: "FormElementBindableText",
                field: "fidelity",
                label: "Fidelity (0-100)"
            },
            {
                class: "FormElementBindableText",
                field: "inCircle",
                label: "Target to Click"
            },
            {
                class: "FormElementBindableText",
                field: "resettingDRO",
                label: "Resetting DRO"
            },
            {
                class: "FormElementBindableText",
                field: "resetScore",
                label: "Reset Score"
            },
            {
                class: "FormElementText",
                field: "mouseHoldLimit",
                label: "Max Mouse Hold Time"
            },
        ].concat(drawableEditorForm()) // add position and size
    }
})

// registers the component itself to be added to objects
registerSimple("component", "BallGame", {
    description: "Ball click task",
})