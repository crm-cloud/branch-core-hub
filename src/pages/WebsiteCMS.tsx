import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Palette, 
  Type, 
  Image, 
  Layout, 
  Star, 
  DollarSign, 
  MessageSquare,
  Save,
  RotateCcw,
  ExternalLink,
  Plus,
  Trash2
} from 'lucide-react';
import { cmsService, ThemeSettings } from '@/services/cmsService';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function WebsiteCMSPage() {
  const [theme, setTheme] = useState<ThemeSettings>(cmsService.getDefaultTheme());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setTheme(cmsService.getTheme());
  }, []);

  const updateTheme = (updates: Partial<ThemeSettings>) => {
    setTheme({ ...theme, ...updates });
    setHasChanges(true);
  };

  const saveTheme = () => {
    cmsService.saveTheme(theme);
    setHasChanges(false);
    toast.success('Website settings saved!');
  };

  const resetTheme = () => {
    const defaultTheme = cmsService.resetTheme();
    setTheme(defaultTheme);
    setHasChanges(false);
    toast.success('Reset to default settings');
  };

  const addFeature = () => {
    updateTheme({
      features: [...theme.features, { title: 'New Feature', description: 'Description here', icon: 'dumbbell' }]
    });
  };

  const removeFeature = (index: number) => {
    updateTheme({
      features: theme.features.filter((_, i) => i !== index)
    });
  };

  const updateFeature = (index: number, updates: Partial<typeof theme.features[0]>) => {
    const newFeatures = [...theme.features];
    newFeatures[index] = { ...newFeatures[index], ...updates };
    updateTheme({ features: newFeatures });
  };

  const addTestimonial = () => {
    updateTheme({
      testimonials: [...theme.testimonials, { name: 'New Member', quote: 'Great gym!' }]
    });
  };

  const removeTestimonial = (index: number) => {
    updateTheme({
      testimonials: theme.testimonials.filter((_, i) => i !== index)
    });
  };

  const updateTestimonial = (index: number, updates: Partial<typeof theme.testimonials[0]>) => {
    const newTestimonials = [...theme.testimonials];
    newTestimonials[index] = { ...newTestimonials[index], ...updates };
    updateTheme({ testimonials: newTestimonials });
  };

  const addPricingPlan = () => {
    updateTheme({
      pricingPlans: [...theme.pricingPlans, { name: 'New Plan', price: 1999, duration: '1 Month', features: ['Feature 1'] }]
    });
  };

  const removePricingPlan = (index: number) => {
    updateTheme({
      pricingPlans: theme.pricingPlans.filter((_, i) => i !== index)
    });
  };

  const updatePricingPlan = (index: number, updates: Partial<typeof theme.pricingPlans[0]>) => {
    const newPlans = [...theme.pricingPlans];
    newPlans[index] = { ...newPlans[index], ...updates };
    updateTheme({ pricingPlans: newPlans });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Website CMS</h1>
            <p className="text-muted-foreground">Manage your public website content and theme</p>
          </div>
          <div className="flex gap-2">
            <Link to="/" target="_blank">
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview Site
              </Button>
            </Link>
            <Button variant="outline" onClick={resetTheme}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button onClick={saveTheme} disabled={!hasChanges}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">
              <Layout className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="hero">
              <Image className="mr-2 h-4 w-4" />
              Hero
            </TabsTrigger>
            <TabsTrigger value="features">
              <Star className="mr-2 h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <DollarSign className="mr-2 h-4 w-4" />
              Pricing
            </TabsTrigger>
            <TabsTrigger value="testimonials">
              <MessageSquare className="mr-2 h-4 w-4" />
              Testimonials
            </TabsTrigger>
            <TabsTrigger value="theme">
              <Palette className="mr-2 h-4 w-4" />
              Theme
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic information about your gym</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <Label>Gym Name</Label>
                    <Input 
                      value={theme.gymName}
                      onChange={(e) => updateTheme({ gymName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tagline</Label>
                    <Input 
                      value={theme.gymTagline}
                      onChange={(e) => updateTheme({ gymTagline: e.target.value })}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <h3 className="font-semibold">Contact Information</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={theme.contactEmail}
                      onChange={(e) => updateTheme({ contactEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input 
                      value={theme.contactPhone}
                      onChange={(e) => updateTheme({ contactPhone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Address</Label>
                  <Textarea 
                    value={theme.address}
                    onChange={(e) => updateTheme({ address: e.target.value })}
                  />
                </div>

                <Separator />

                <h3 className="font-semibold">Social Links</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Instagram</Label>
                    <Input 
                      value={theme.socialLinks.instagram || ''}
                      onChange={(e) => updateTheme({ socialLinks: { ...theme.socialLinks, instagram: e.target.value } })}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div>
                    <Label>Facebook</Label>
                    <Input 
                      value={theme.socialLinks.facebook || ''}
                      onChange={(e) => updateTheme({ socialLinks: { ...theme.socialLinks, facebook: e.target.value } })}
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div>
                    <Label>Twitter/X</Label>
                    <Input 
                      value={theme.socialLinks.twitter || ''}
                      onChange={(e) => updateTheme({ socialLinks: { ...theme.socialLinks, twitter: e.target.value } })}
                      placeholder="https://twitter.com/..."
                    />
                  </div>
                  <div>
                    <Label>YouTube</Label>
                    <Input 
                      value={theme.socialLinks.youtube || ''}
                      onChange={(e) => updateTheme({ socialLinks: { ...theme.socialLinks, youtube: e.target.value } })}
                      placeholder="https://youtube.com/..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hero Section */}
          <TabsContent value="hero">
            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
                <CardDescription>The main banner visitors see first</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Hero Title</Label>
                  <Input 
                    value={theme.heroTitle}
                    onChange={(e) => updateTheme({ heroTitle: e.target.value })}
                    placeholder="TRANSFORM YOUR BODY"
                  />
                </div>
                <div>
                  <Label>Hero Subtitle</Label>
                  <Textarea 
                    value={theme.heroSubtitle}
                    onChange={(e) => updateTheme({ heroSubtitle: e.target.value })}
                    placeholder="Where Champions Are Made"
                  />
                </div>
                <div>
                  <Label>Hero Image URL</Label>
                  <Input 
                    value={theme.heroImage}
                    onChange={(e) => updateTheme({ heroImage: e.target.value })}
                    placeholder="/gym-hero.jpg"
                  />
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input 
                    value={theme.logoUrl}
                    onChange={(e) => updateTheme({ logoUrl: e.target.value })}
                    placeholder="/logo.png"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features */}
          <TabsContent value="features">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Features</CardTitle>
                  <CardDescription>Highlight your gym's best offerings</CardDescription>
                </div>
                <Button onClick={addFeature}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Feature
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {theme.features.map((feature, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid gap-4 md:grid-cols-3">
                        <div>
                          <Label>Title</Label>
                          <Input 
                            value={feature.title}
                            onChange={(e) => updateFeature(index, { title: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Icon</Label>
                          <Input 
                            value={feature.icon}
                            onChange={(e) => updateFeature(index, { icon: e.target.value })}
                            placeholder="dumbbell, users, activity, clock"
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Input 
                            value={feature.description}
                            onChange={(e) => updateFeature(index, { description: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFeature(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing */}
          <TabsContent value="pricing">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pricing Plans</CardTitle>
                  <CardDescription>Manage your membership pricing display</CardDescription>
                </div>
                <Button onClick={addPricingPlan}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Plan
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {theme.pricingPlans.map((plan, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 grid gap-4 md:grid-cols-4">
                          <div>
                            <Label>Name</Label>
                            <Input 
                              value={plan.name}
                              onChange={(e) => updatePricingPlan(index, { name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Price (₹)</Label>
                            <Input 
                              type="number"
                              value={plan.price}
                              onChange={(e) => updatePricingPlan(index, { price: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label>Duration</Label>
                            <Input 
                              value={plan.duration}
                              onChange={(e) => updatePricingPlan(index, { duration: e.target.value })}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <Switch 
                              checked={plan.isPopular || false}
                              onCheckedChange={(checked) => updatePricingPlan(index, { isPopular: checked })}
                            />
                            <Label>Popular</Label>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removePricingPlan(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div>
                        <Label>Features (one per line)</Label>
                        <Textarea 
                          value={plan.features.join('\n')}
                          onChange={(e) => updatePricingPlan(index, { features: e.target.value.split('\n').filter(f => f.trim()) })}
                          rows={4}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Testimonials */}
          <TabsContent value="testimonials">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Testimonials</CardTitle>
                  <CardDescription>Member success stories</CardDescription>
                </div>
                <Button onClick={addTestimonial}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Testimonial
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {theme.testimonials.map((testimonial, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Name</Label>
                          <Input 
                            value={testimonial.name}
                            onChange={(e) => updateTestimonial(index, { name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Image URL (optional)</Label>
                          <Input 
                            value={testimonial.image || ''}
                            onChange={(e) => updateTestimonial(index, { image: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Quote</Label>
                          <Textarea 
                            value={testimonial.quote}
                            onChange={(e) => updateTestimonial(index, { quote: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTestimonial(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme */}
          <TabsContent value="theme">
            <Card>
              <CardHeader>
                <CardTitle>Theme Settings</CardTitle>
                <CardDescription>Customize colors and fonts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <input 
                        type="color"
                        value={theme.primaryColor}
                        onChange={(e) => updateTheme({ primaryColor: e.target.value })}
                        className="h-10 w-20 rounded border cursor-pointer"
                      />
                      <Input 
                        value={theme.primaryColor}
                        onChange={(e) => updateTheme({ primaryColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <input 
                        type="color"
                        value={theme.accentColor}
                        onChange={(e) => updateTheme({ accentColor: e.target.value })}
                        className="h-10 w-20 rounded border cursor-pointer"
                      />
                      <Input 
                        value={theme.accentColor}
                        onChange={(e) => updateTheme({ accentColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Background Color</Label>
                    <div className="flex gap-2">
                      <input 
                        type="color"
                        value={theme.backgroundColor}
                        onChange={(e) => updateTheme({ backgroundColor: e.target.value })}
                        className="h-10 w-20 rounded border cursor-pointer"
                      />
                      <Input 
                        value={theme.backgroundColor}
                        onChange={(e) => updateTheme({ backgroundColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Text Color</Label>
                    <div className="flex gap-2">
                      <input 
                        type="color"
                        value={theme.textColor}
                        onChange={(e) => updateTheme({ textColor: e.target.value })}
                        className="h-10 w-20 rounded border cursor-pointer"
                      />
                      <Input 
                        value={theme.textColor}
                        onChange={(e) => updateTheme({ textColor: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Font Family</Label>
                  <Input 
                    value={theme.fontFamily}
                    onChange={(e) => updateTheme({ fontFamily: e.target.value })}
                    placeholder="Inter, sans-serif"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
