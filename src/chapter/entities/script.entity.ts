import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

// These match the story JSON contract we agreed on as a team, which is why
// the field names are snake_case. None of the parts need their own _id since
// line_id and the flag names already identify them.

@Schema({ _id: false })
export class ScriptText {
  @Prop({ type: [String], required: true })
  words: string[];
}

export const ScriptTextSchema = SchemaFactory.createForClass(ScriptText);

@Schema({ _id: false })
export class DialogueLine {
  @Prop({ required: true })
  name: string;

  // which of the character's emotions to show, "default" if the script didn't pick one
  @Prop({ required: true })
  portrait: string;

  @Prop({ type: ScriptTextSchema, required: true })
  text: ScriptText;

  // not used yet
  @Prop({ type: String, default: null })
  text_color: string | null;
}

export const DialogueLineSchema = SchemaFactory.createForClass(DialogueLine);

// narration, basically any text that isn't a character talking
@Schema({ _id: false })
export class ProseLine {
  @Prop({ type: ScriptTextSchema, required: true })
  text: ScriptText;

  // not used yet
  @Prop({ type: String, default: null })
  text_color: string | null;
}

export const ProseLineSchema = SchemaFactory.createForClass(ProseLine);

@Schema({ _id: false })
export class ChoiceOption {
  @Prop({ required: true, min: 0 })
  goto_line: number;

  @Prop({ required: true })
  option_body: string;

  // will be used later to hide options based on story variables
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  condition: null;
}

export const ChoiceOptionSchema = SchemaFactory.createForClass(ChoiceOption);

// only one of dialogue/prose/choice/background/goto_line/end is set on each line
@Schema({ _id: false })
export class ScriptLine {
  // same as the line's index in lines, goto_line and flags point at this
  @Prop({ required: true, min: 0 })
  line_id: number;

  @Prop({ type: DialogueLineSchema })
  dialogue?: DialogueLine;

  @Prop({ type: ProseLineSchema })
  prose?: ProseLine;

  // without default undefined mongoose adds an empty choice array to every single line
  @Prop({ type: [ChoiceOptionSchema], default: undefined })
  choice?: ChoiceOption[];

  @Prop({ type: String })
  background?: string;

  @Prop({ type: Number, min: 0 })
  goto_line?: number;

  @Prop({ type: Boolean })
  end?: true;
}

export const ScriptLineSchema = SchemaFactory.createForClass(ScriptLine);

@Schema({ _id: false })
export class Flag {
  @Prop({ required: true, min: 0 })
  line_id: number;
}

export const FlagSchema = SchemaFactory.createForClass(Flag);

// the reader starts at lines[0] and goes from there
@Schema({ _id: false })
export class Script {
  @Prop({ type: Map, of: FlagSchema, default: {} })
  flags: Map<string, Flag>;

  // variables come in a later sprint so this is always empty for now
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  variables: unknown[];

  @Prop({ type: [ScriptLineSchema], default: [] })
  lines: ScriptLine[];
}

export const ScriptSchema = SchemaFactory.createForClass(Script);
