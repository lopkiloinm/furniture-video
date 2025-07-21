from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import requests
import os
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables
load_dotenv()

app = FastAPI()

# Request models
class ConversationRequest(BaseModel):
    user_message: str
    conversation_history: list[dict]
    current_step: int
    conversation_data: dict

class HousePromptRequest(BaseModel):
    house_prompt: str

class SelectedIndicesRequest(BaseModel):
    selected_indices: list[int]

# Configure CORS to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Real 4x4 furniture JSON data (flattened from 2D array)
FURNITURE_DATA = [
    # Row 1
    {
        "name": "Mid-Century Sofa",
        "price": 799,
        "properties": {
            "type": "sofa",
            "style": "mid-century modern",
            "material": "fabric, wood legs",
            "color": "brown",
            "dimensions": "70x35x33 in"
        },
        "description": "A compact brown 2-seater with tufted cushions and wooden legs."
    },
    {
        "name": "Beige Armchair",
        "price": 349,
        "properties": {
            "type": "armchair",
            "style": "contemporary",
            "material": "fabric, wood",
            "color": "beige",
            "dimensions": "36x34x34 in"
        },
        "description": "Comfortable beige armchair with clean lines and wide arms."
    },
    {
        "name": "Slatted Coffee Table",
        "price": 229,
        "properties": {
            "type": "coffee table",
            "style": "Scandinavian",
            "material": "solid wood",
            "color": "walnut",
            "dimensions": "40x20x18 in"
        },
        "description": "Wooden coffee table with lower slatted shelf."
    },
    {
        "name": "Wooden Dining Chair",
        "price": 139,
        "properties": {
            "type": "dining chair",
            "style": "classic",
            "material": "wood",
            "color": "natural oak",
            "dimensions": "18x20x34 in"
        },
        "description": "Spindle-back chair with angled legs for dining spaces."
    },
    # Row 2
    {
        "name": "Oval Dining Table",
        "price": 499,
        "properties": {
            "type": "dining table",
            "style": "mid-century",
            "material": "walnut wood",
            "color": "brown",
            "dimensions": "60x36x30 in"
        },
        "description": "Smooth oval dining table with tapered legs."
    },
    {
        "name": "Tufted Lounge Chair",
        "price": 299,
        "properties": {
            "type": "lounge chair",
            "style": "retro",
            "material": "fabric, wood",
            "color": "gray",
            "dimensions": "28x30x32 in"
        },
        "description": "Gray lounge chair with soft curves and button tufting."
    },
    {
        "name": "3-Drawer Chest",
        "price": 269,
        "properties": {
            "type": "dresser",
            "style": "modern",
            "material": "pine wood",
            "color": "light wood",
            "dimensions": "32x16x36 in"
        },
        "description": "Compact dresser with natural finish and round knobs."
    },
    {
        "name": "Open Bookshelf",
        "price": 189,
        "properties": {
            "type": "bookshelf",
            "style": "minimalist",
            "material": "engineered wood",
            "color": "dark brown",
            "dimensions": "24x12x48 in"
        },
        "description": "Three-tier bookshelf ideal for small living spaces."
    },
    # Row 3
    {
        "name": "Nightstand with Drawer",
        "price": 129,
        "properties": {
            "type": "nightstand",
            "style": "functional",
            "material": "oak wood",
            "color": "medium oak",
            "dimensions": "18x18x24 in"
        },
        "description": "Single-drawer nightstand with lower shelf."
    },
    {
        "name": "Beige Ottoman",
        "price": 159,
        "properties": {
            "type": "ottoman",
            "style": "contemporary",
            "material": "upholstered fabric",
            "color": "cream",
            "dimensions": "26x20x18 in"
        },
        "description": "Soft ottoman for footrest or extra seating."
    },
    {
        "name": "Leather Accent Chair",
        "price": 399,
        "properties": {
            "type": "accent chair",
            "style": "vintage",
            "material": "leather, wood",
            "color": "dark brown",
            "dimensions": "28x30x32 in"
        },
        "description": "Brown leather chair with angled wood armrests."
    },
    {
        "name": "Tall End Table",
        "price": 149,
        "properties": {
            "type": "side table",
            "style": "mid-century",
            "material": "teak wood",
            "color": "natural",
            "dimensions": "16x16x26 in"
        },
        "description": "Tall cabinet-style side table with enclosed storage."
    },
    # Row 4
    {
        "name": "Ladder Bookshelf",
        "price": 199,
        "properties": {
            "type": "bookshelf",
            "style": "ladder",
            "material": "birch wood",
            "color": "light wood",
            "dimensions": "26x14x60 in"
        },
        "description": "Open-back ladder-style shelf for books and decor."
    },
    {
        "name": "Writing Desk",
        "price": 289,
        "properties": {
            "type": "desk",
            "style": "Scandinavian",
            "material": "solid wood",
            "color": "honey oak",
            "dimensions": "40x22x30 in"
        },
        "description": "Minimal desk perfect for home office or study nook."
    },
    {
        "name": "Double-Door Cabinet",
        "price": 219,
        "properties": {
            "type": "cabinet",
            "style": "modern",
            "material": "wood veneer",
            "color": "espresso",
            "dimensions": "28x16x30 in"
        },
        "description": "Compact dark cabinet with concealed storage."
    },
    {
        "name": "Platform Bed Frame",
        "price": 599,
        "properties": {
            "type": "bed frame",
            "style": "contemporary",
            "material": "wood",
            "color": "natural pine",
            "dimensions": "60x80x14 in"
        },
        "description": "Simple queen platform bed with slatted headboard."
    }
]

@app.get("/")
async def root():
    return {"message": "Furniture API Server"}

@app.get("/api/furniture")
async def get_furniture():
    """Return the 4x4 furniture JSON data"""
    return FURNITURE_DATA

@app.post("/api/conversation")
async def handle_conversation(request: ConversationRequest):
    """Handle full conversation flow with Kimi K2"""
    try:
        # Get API key from environment
        api_key = os.getenv("GMI_CLOUD_API_KEY")
        if not api_key:
            return {"status": "error", "message": "API key not configured"}

        # Build conversation context for Kimi K2
        step_names = ["Welcome", "Space Details", "Style Preferences", "Budget & Requirements", "Analysis", "Furniture Selection", "Video Generation", "Complete"]
        current_step_name = step_names[min(request.current_step - 1, len(step_names) - 1)]
        
        system_prompt = """You are a helpful interior designer. Be conversational and friendly. 

CRITICAL RULES:
1. Always complete your full response before stopping
2. Never cut off mid-sentence, mid-word, or mid-list
3. Provide complete lists of options (e.g., "modern, cozy, rustic, minimalist, traditional")
4. Use proper markdown formatting with complete **bold** tags
5. Give detailed, engaging responses that feel natural and conversational

Respond naturally to user input without rushing them to the next step."""

        # Minimal context - only what's needed
        conversation_context = f"Step {request.current_step} of 8. "
        
        # Handle different message types
        if request.user_message.startswith("SYSTEM_START:"):
            conversation_context += "Introduce yourself as an interior designer and ask about their furniture project."
        else:
            # Regular conversation
            conversation_context += f"User said: '{request.user_message}'. "
            
            # Natural conversation guidance based on current step
            if request.current_step == 1:
                conversation_context += "You're learning about their project. Ask follow-up questions about their space and goals naturally."
            elif request.current_step == 2:
                conversation_context += "You're gathering space details. Ask about size, layout, current furniture, or any specific needs they mentioned."  
            elif request.current_step == 3:
                conversation_context += "You're exploring their style preferences. Discuss different aesthetics and what appeals to them."
            elif request.current_step == 4:
                conversation_context += "You're understanding their budget and requirements. Explore their financial considerations and special needs."
                
            conversation_context += " Respond naturally and conversationally. Let the user guide the pace."

        # Debug logging for request
        print(f"=== REQUEST DEBUG ===")
        print(f"Current Step: {request.current_step} - {current_step_name}")
        print(f"User Message: '{request.user_message}'")
        print(f"System Prompt Length: {len(system_prompt)} chars")
        print(f"Conversation Context Length: {len(conversation_context)} chars")
        print(f"Total Prompt Length: {len(system_prompt) + len(conversation_context)} chars")
        print(f"Max Tokens: 2000")
        
        total_prompt_length = len(system_prompt) + len(conversation_context)
        if total_prompt_length > 1000:
            print(f"⚠️  Long prompt ({total_prompt_length} chars) - might affect response")
        
        # Make API call to Kimi K2
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        payload = {
            "model": "moonshotai/Kimi-K2-Instruct",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": conversation_context}
            ],
            "temperature": 0.7,
            "max_tokens": 2000
        }

        print(f"Making conversation API request...")
        response = requests.post(
            "https://api.gmi-serving.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        print(f"API response status: {response.status_code}")

        if response.status_code == 200:
            ai_response = response.json()
            print(f"FULL API RESPONSE: {ai_response}")
            
            ai_message = ai_response.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Debug logging
            print(f"=== AI RESPONSE DEBUG ===")
            print(f"Raw AI Response: '{ai_message}'")
            print(f"AI Response Length: {len(ai_message)} characters")
            print(f"Response ends with: '{ai_message[-20:]}'")
            
            # Check finish reason
            finish_reason = ai_response.get("choices", [{}])[0].get("finish_reason", "unknown")
            print(f"Finish Reason: {finish_reason}")
            
            if finish_reason == "length":
                print("🚨 WARNING: Response was truncated due to token limit!")
            
            # Check usage info
            usage = ai_response.get("usage", {})
            print(f"Token Usage: {usage}")
            
            if usage.get("completion_tokens", 0) >= 1900:
                print("⚠️  WARNING: Near token limit, might be truncated!")
            
            print(f"=== MESSAGE PROCESSING ===")
            print(f"Final AI Response: '{ai_message}'")
            print(f"Response Length: {len(ai_message)} characters")
            
            if len(ai_message) < 20:
                print("🚨 ALERT: AI response suspiciously short!")
            
            return {
                "status": "success",
                "ai_response": ai_message,
                "advance_step": False  # User controls advancement now
            }
        else:
            return {"status": "error", "message": f"AI API error: {response.status_code}"}
            
    except Exception as e:
        print(f"Error in conversation handler: {str(e)}")
        return {"status": "error", "message": "Failed to process conversation"}

@app.post("/api/selected-furniture")
async def get_selected_furniture(request: SelectedIndicesRequest):
    """Return only AI-selected furniture items"""
    selected_indices = request.selected_indices
    selected_furniture = []
    
    for index in selected_indices:
        if 0 <= index < len(FURNITURE_DATA):
            furniture_item = FURNITURE_DATA[index].copy()
            furniture_item["original_index"] = index  # Keep track of original index for images
            selected_furniture.append(furniture_item)
    
    return selected_furniture

@app.post("/api/run-agent")
async def run_agent(request: HousePromptRequest):
    """Run AI agent to select furniture based on house prompt"""
    try:
        # Get API key from environment
        api_key = os.getenv("GMI_CLOUD_API_KEY")
        if not api_key:
            return {"status": "error", "message": "API key not configured"}
        
        # Prepare AI prompt for furniture selection
        ai_prompt = f"""You are an expert interior designer helping a client furnish their space. 

        CLIENT'S REQUIREMENTS: "{request.house_prompt}"

        Available furniture catalog (16 pieces):
        0: Mid-Century Sofa ($799) - Brown 2-seater with tufted cushions and wooden legs. Style: mid-century modern
        1: Beige Armchair ($349) - Contemporary with clean lines and wide arms. Style: contemporary  
        2: Slatted Coffee Table ($229) - Scandinavian walnut wood with lower shelf. Style: Scandinavian
        3: Wooden Dining Chair ($139) - Classic spindle-back oak for dining spaces. Style: classic
        4: Oval Dining Table ($499) - Mid-century walnut wood with tapered legs. Style: mid-century
        5: Tufted Lounge Chair ($299) - Retro gray with soft curves and button tufting. Style: retro
        6: 3-Drawer Chest ($269) - Modern pine wood dresser with natural finish. Style: modern
        7: Open Bookshelf ($189) - Minimalist dark brown for small spaces. Style: minimalist
        8: Nightstand with Drawer ($129) - Functional medium oak with lower shelf. Style: functional
        9: Beige Ottoman ($159) - Contemporary cream fabric for footrest/seating. Style: contemporary
        10: Leather Accent Chair ($399) - Vintage dark brown with angled wood armrests. Style: vintage
        11: Tall End Table ($149) - Mid-century teak storage cabinet-style. Style: mid-century
        12: Ladder Bookshelf ($199) - Light birch wood open-back design. Style: ladder
        13: Writing Desk ($289) - Scandinavian honey oak for home office. Style: Scandinavian
        14: Double-Door Cabinet ($219) - Modern espresso veneer with concealed storage. Style: modern
        15: Platform Bed Frame ($599) - Contemporary natural pine with slatted headboard. Style: contemporary

        As an expert designer, select 8-12 pieces that would work perfectly together for this client's space.
        Consider style cohesion, functional needs, space requirements, and aesthetic harmony.

        Return ONLY a JSON array of indices: [0,1,2,4,5,8,9,13]"""

        # Make API call to GMI Cloud
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        payload = {
            "model": "moonshotai/Kimi-K2-Instruct",
            "messages": [
                {"role": "system", "content": "You are an expert interior designer. Always respond with only a valid JSON array of furniture indices."},
                {"role": "user", "content": ai_prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 100
        }

        response = requests.post(
            "https://api.gmi-serving.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            ai_response = response.json()
            selected_content = ai_response.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            try:
                # Parse the AI response to get selected furniture indices
                selected_indices = json.loads(selected_content.strip())
                
                # Validate indices are within range
                selected_indices = [i for i in selected_indices if isinstance(i, int) and 0 <= i <= 15]
                
                return {
                    "status": "complete", 
                    "selected_indices": selected_indices,
                    "ai_reasoning": selected_content
                }
            except json.JSONDecodeError:
                # Fallback to default selection if AI response isn't valid JSON
                return {
                    "status": "complete",
                    "selected_indices": [0, 1, 2, 4, 5, 8, 9, 13],
                    "ai_reasoning": "Used default selection due to parsing error"
                }
        else:
            return {"status": "error", "message": f"AI API error: {response.status_code}"}
            
    except Exception as e:
        print(f"Error in AI agent: {str(e)}")
        return {"status": "error", "message": "AI agent processing failed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 