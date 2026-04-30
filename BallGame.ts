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

    debug: boolean;
    
    // for rendering
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    scoreY: number;
    scoreColour: string;

    // ball variables
    ballPos: Position;
    ballTarget: Position;
    ballVel: Position; // Not a position but it's fine idc

    score: number;
    clickTimer: number; // time between clicks
    textTimer: number; // time before text returns to black
    lastFrame: number; // timestamp of previous frame

    lastClick: Position;
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
        this.factory.ballTarget = this.factory.ballPos; // this forces it to be re-chosen and sets the velocity

        this.factory.lastClick = { x:0, y:0 };

        // actual start of the game
        if(this.runtimeModeOrEditorPlaying) {
            console.log("a");
        }
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
            this.factory.lastClick = click;

            if (this.calculateDistance(click, this.factory.ballPos) <= this.factory.ballRadius) {
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
        // decrement timers
        if (this.factory.textTimer > 0)
            this.factory.textTimer--;

        // figure out time between frames in ms
        let time = Date.now();
        let dt = time - this.factory.lastFrame ?? time + 1000;

        let d = this.calculateDistance(this.factory.ballTarget, this.factory.ballPos);

        // choose new target if target is touching the ball. loop in case new target
        // is also within the ball
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
        if (dt > 0) {
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
        ctx.fillText(`click x: ${this.factory.lastClick.x}`, 10, this.factory.fontSize);
        ctx.fillText(`click y: ${this.factory.lastClick.y}`, 10, Number(this.factory.fontSize) * 2);
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
                label: "Text Highlight Duration"
            },
            {
                class: "FormElementToggle",
                field: "debug",
                label: "Show Debug Info"
            },
        ].concat(drawableEditorForm()) // add position and size
    }
})

// registers the component itself to be added to objects
registerSimple("component", "BallGame", {
    description: "Ball click task",
})